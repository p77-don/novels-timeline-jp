// ============================================================
// TimelineView.ts
// Novels Timeline JP — Obsidian ItemView（完全版）
// ============================================================

import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Menu,
  Notice,
} from "obsidian";

import { EventStore }       from "../store/EventStore";
import { CacheStore }       from "../store/CacheStore";
import { DiscoveryEngine }  from "../engine/DiscoveryEngine";
import { LayoutEngine, LANE_MIN, LANE_MAX, LANES_START_Y } from "../engine/LayoutEngine";
import { RelationEngine }   from "../engine/RelationEngine";
import { GapEngine }        from "../engine/GapEngine";
import { FilterEngine }     from "../engine/FilterEngine";
import { TimelineRenderer, DateRow } from "./TimelineRenderer";
import { TableView } from "./TableView";
import { DateParser } from "../parser/DateParser";
import { NTJP_KEYS } from "../parser/TimelineParser";
import { MeasureModal } from "./MeasureModal";
import {
  getMonthDef,
  BOARD_ZOOM_MIN,
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_DEFAULT,
  BOARD_ZOOM_STEP,
} from "../settings/PluginSettings";

import {
  TimelineEvent,
  LayoutNode,
  GapSegment,
  FilterState,
  VirtualWindow,
} from "../types/TimelineTypes";

import type NovelsTimelinePlugin from "../main";

export const TIMELINE_VIEW_TYPE = "novels-timeline-jp";

export class TimelineView extends ItemView {
  private plugin: NovelsTimelinePlugin;

  private eventStore:     EventStore;
  private cacheStore:     CacheStore;
  private discovery:      DiscoveryEngine;
  private layoutEngine:   LayoutEngine;
  private relationEngine: RelationEngine;
  private gapEngine:      GapEngine;
  private filterEngine:   FilterEngine;

  private renderer!:   TimelineRenderer;
  private nodes:       LayoutNode[]  = [];
  private gaps:        GapSegment[]  = [];
  private selectedId:  string | null = null;

  // ノード間日数計測モード
  private measureMode:       boolean = false;
  private measureStartEvent: TimelineEvent | null = null;

  private filterState: FilterState = {
    characters:  new Set(),
    locations:   new Set(),
    searchQuery: "",
  };

  private toolbarEl!:    HTMLElement;
  private timelineEl!:   HTMLElement;
  private zoomWrapperEl!: HTMLElement;
  private tableContainerEl!: HTMLElement;
  private searchInput!:  HTMLInputElement;
  private debugOverlay!: HTMLElement;
  private viewModeBtn!:  HTMLElement;
  private zoomIndicatorEl!: HTMLElement;

  private viewMode: "timeline" | "table" = "timeline";
  private tableView!: TableView;

  // タイマーID
  private renderTimer:    ReturnType<typeof setTimeout> | null = null;
  private zoomSaveTimer:  ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NovelsTimelinePlugin) {
    super(leaf);
    this.plugin = plugin;

    const { app, settings } = plugin;
    this.eventStore     = new EventStore();
    this.cacheStore     = new CacheStore(app);
    this.discovery      = new DiscoveryEngine(app, settings.calendar, settings.excludedFolders);
    this.layoutEngine   = new LayoutEngine(settings.calendar);
    this.relationEngine = new RelationEngine();
    this.gapEngine      = new GapEngine(settings.calendar);
    this.filterEngine   = new FilterEngine();
  }

  getViewType():    string { return TIMELINE_VIEW_TYPE; }
  getDisplayText(): string { return "Novels Timeline JP"; }
  getIcon():        string { return "book-open"; }

  /** 現在保持している全イベントを返す（EventSidebarView の関連イベント選択などから使用） */
  getAllEvents(): TimelineEvent[] {
    return this.eventStore.getAll();
  }

  async onOpen(): Promise<void> {
    await this.buildUI();
    await this.loadAll();
    this.registerFileWatcher();
  }

  async onClose(): Promise<void> {
    // タイマーをすべてクリア（フリーズ防止）
    if (this.renderTimer)   clearTimeout(this.renderTimer);
    if (this.zoomSaveTimer) clearTimeout(this.zoomSaveTimer);
    this.renderer?.destroy();
  }

  // ----------------------------------------------------------
  // UI 構築
  // ----------------------------------------------------------

  private async buildUI(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("ntj-view");

    this.toolbarEl = root.createDiv({ cls: "ntj-toolbar" });
    this.buildToolbar();

    this.timelineEl = root.createDiv({ cls: "ntj-timeline" });

    // ズームラッパー：この要素にのみ CSS zoom を適用し、
    // ボード（スクロール範囲）全体を拡大縮小する。
    // デバッグオーバーレイはこの外側（timelineEl直下）に置き、ズームの影響を受けない。
    this.zoomWrapperEl = this.timelineEl.createDiv({ cls: "ntj-timeline-zoom-wrapper" });
    this.renderer = new TimelineRenderer(this.zoomWrapperEl);
    this.applyBoardZoom();

    this.tableContainerEl = root.createDiv({ cls: "ntj-table-container" });
    this.tableContainerEl.style.display = "none";
    this.tableView = new TableView(this.tableContainerEl);

    this.debugOverlay = this.timelineEl.createDiv({ cls: "ntj-debug-overlay" });
    this.debugOverlay.style.display = "none";

    // スクロール → 再描画（仮想描画更新 + ルーラー位置更新）
    this.timelineEl.addEventListener("scroll", () => this.scheduleRender());

    // ダブルクリック → 関係線の選択を解除して再描画
    this.timelineEl.addEventListener("dblclick", (e: MouseEvent) => {
      // ノード上のダブルクリックは除外（SVGCircleElement）
      const target = e.target as Element;
      if (target && target.tagName === "circle") return;
      if (this.selectedId !== null) {
        this.selectedId = null;
        this.scheduleRender();
      }
    });

    // Shift+ホイール → ボードズーム（拡大縮小）
    // Ctrl/Cmd+ホイール → 左右スクロール
    this.timelineEl.addEventListener("wheel", (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        // 上スクロール(deltaY<0) = 拡大、下スクロール(deltaY>0) = 縮小
        this.adjustBoardZoom(e.deltaY < 0 ? BOARD_ZOOM_STEP : -BOARD_ZOOM_STEP);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // deltaY を横スクロール量として使用（1ステップ=60px）
      const delta = e.deltaY > 0 ? 60 : -60;
      this.timelineEl.scrollLeft += delta;
    }, { passive: false });

    // ドラッグパン（上下左右）
    // ノードのドラッグ（lane変更）と区別するため、SVG背景上のみ反応させる
    this.registerPanEvents();

    // Esc → ノード間日数計測モードを中止
    this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.measureMode) {
        this.cancelMeasureMode();
      }
    });
  }

  // ----------------------------------------------------------
  // ボードズーム（タイムラインボード全体の拡大縮小）
  // ノード単体の倍率ではなく、スクロール可能なボード全体を
  // CSS zoom で拡大縮小する。範囲: 50%〜200%、既定値: 100%
  // ----------------------------------------------------------

  /** 現在の設定値を zoomWrapperEl に反映する */
  private applyBoardZoom(): void {
    const zoom = this.plugin.settings.boardZoom;
    this.zoomWrapperEl.style.zoom = `${zoom / 100}`;
    if (this.zoomIndicatorEl) this.zoomIndicatorEl.textContent = `${zoom}%`;
  }

  /** ズーム値を絶対値で設定する（ズームパネルのスライダー用） */
  private setBoardZoom(newZoomAbsolute: number): void {
    const settings = this.plugin.settings;
    const newZoom = Math.max(
      BOARD_ZOOM_MIN,
      Math.min(BOARD_ZOOM_MAX, Math.round(newZoomAbsolute))
    );
    if (newZoom === settings.boardZoom) return;

    settings.boardZoom = newZoom;
    this.applyBoardZoom();
    this.scheduleRender();

    if (this.zoomSaveTimer) clearTimeout(this.zoomSaveTimer);
    this.zoomSaveTimer = setTimeout(() => {
      void this.plugin.saveSettings();
    }, 400);
  }

  /**
   * ホイール操作等でズーム値を段階的に変更する。
   * ★ 設定の保存(saveSettings)は高頻度イベントから直接呼ばない
   *   （wheel連打→保存の連鎖でフリーズする恐れがあるため、デバウンスする）。
   */
  private adjustBoardZoom(deltaPercent: number): void {
    this.setBoardZoom(this.plugin.settings.boardZoom + deltaPercent);
  }

  /** ズーム値を既定値(100%)にリセットする */
  private resetBoardZoom(): void {
    if (this.plugin.settings.boardZoom === 100) return;
    this.plugin.settings.boardZoom = 100;
    this.applyBoardZoom();
    this.scheduleRender();
    void this.plugin.saveSettings();
  }

  // ドラッグパン状態
  private pan = { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };

  private registerPanEvents(): void {
    const el = this.timelineEl;

    el.addEventListener("mousedown", (e: MouseEvent) => {
      // ノード（ntj-node）上のクリックはパンしない
      if ((e.target as Element).closest(".ntj-node")) return;
      if (e.button !== 0) return;
      e.preventDefault();
      this.pan = {
        active:     true,
        startX:     e.clientX,
        startY:     e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop:  el.scrollTop,
      };
      el.style.cursor = "grabbing";
    });

    el.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.pan.active) return;
      const dx = e.clientX - this.pan.startX;
      const dy = e.clientY - this.pan.startY;
      el.scrollLeft = this.pan.scrollLeft - dx;
      el.scrollTop  = this.pan.scrollTop  - dy;
    });

    const endPan = () => {
      if (!this.pan.active) return;
      this.pan.active = false;
      el.style.cursor = "";
    };

    el.addEventListener("mouseup",    endPan);
    el.addEventListener("mouseleave", endPan);
  }

  private buildToolbar(): void {
    // ─── 検索ボックス＋クリアボタン ───
    const searchWrapper = this.toolbarEl.createDiv({ cls: "ntj-search-wrapper" });
    this.searchInput = searchWrapper.createEl("input", {
      type: "text",
      cls:  "ntj-search",
      placeholder: "検索...",
    });
    this.searchInput.addEventListener("input", () => {
      this.filterState.searchQuery = this.searchInput.value;
      clearBtn.style.display = this.searchInput.value ? "block" : "none";
      this.scheduleRender();
    });
    const clearBtn = searchWrapper.createEl("button", { cls: "ntj-search-clear", text: "✕" });
    clearBtn.style.display = "none";
    clearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.filterState.searchQuery = "";
      clearBtn.style.display = "none";
      this.scheduleRender();
      this.searchInput.focus();
    });

    // ─── 人物フィルタ ───
    this.buildFilterPanel("ntj-filter-characters", "人物▼", "characters");

    // ─── 場所フィルタ ───
    this.buildFilterPanel("ntj-filter-locations", "場所▼", "locations");

    const modeLabels: Record<string, string> = {
      selected: "関係線:選択",
      always:   "関係線:全表示",
      hidden:   "関係線:非表示",
    };
    const relationBtn = this.toolbarEl.createEl("button", {
      cls:  "ntj-btn",
      text: modeLabels[this.plugin.settings.relationDisplayMode] ?? "関係線",
    });
    relationBtn.addEventListener("click", () => {
      const modes   = ["selected", "always", "hidden"] as const;
      const current = this.plugin.settings.relationDisplayMode;
      const next    = modes[(modes.indexOf(current) + 1) % modes.length];
      this.plugin.settings.relationDisplayMode = next;
      relationBtn.textContent = modeLabels[next];
      this.plugin.saveSettings();
      this.scheduleRender();
    });

    // ─── テーブル/タイムライン切替ボタン ───
    this.viewModeBtn = this.toolbarEl.createEl("button", {
      cls:  "ntj-btn ntj-view-mode-btn",
      text: "一覧表示",
    });
    this.viewModeBtn.addEventListener("click", () => {
      this.toggleViewMode();
    });

    // ─── ボードズーム表示（クリックでスライダーパネルを表示） ───
    const zoomWrapper = this.toolbarEl.createDiv({ cls: "ntj-zoom-wrapper" });
    this.zoomIndicatorEl = zoomWrapper.createEl("button", {
      cls:   "ntj-btn ntj-zoom-indicator",
      text:  `${this.plugin.settings.boardZoom}%`,
      title: `クリックでスライダーを表示（${BOARD_ZOOM_MIN}〜${BOARD_ZOOM_MAX}%、${BOARD_ZOOM_STEP}%刻み）\nタイムライン上で Shift+ホイールでも変更できます`,
    });

    const zoomPanel = zoomWrapper.createDiv({ cls: "ntj-zoom-panel" });
    zoomPanel.style.display = "none";

    const zoomSlider = zoomPanel.createEl("input", { cls: "ntj-zoom-slider" });
    zoomSlider.type  = "range";
    zoomSlider.min   = String(BOARD_ZOOM_MIN);
    zoomSlider.max   = String(BOARD_ZOOM_MAX);
    zoomSlider.step  = String(BOARD_ZOOM_STEP);
    zoomSlider.value = String(this.plugin.settings.boardZoom);

    const zoomValueLabel = zoomPanel.createSpan({
      cls: "ntj-zoom-panel-value",
      text: `${this.plugin.settings.boardZoom}%`,
    });

    const zoomResetBtn = zoomPanel.createEl("button", {
      cls: "ntj-zoom-panel-reset",
      text: "リセット",
      title: `${BOARD_ZOOM_DEFAULT}%に戻す`,
    });

    zoomSlider.addEventListener("input", () => {
      const v = parseInt(zoomSlider.value, 10);
      this.setBoardZoom(v);
      zoomValueLabel.textContent = `${this.plugin.settings.boardZoom}%`;
    });

    zoomResetBtn.addEventListener("click", () => {
      this.resetBoardZoom();
      zoomSlider.value = String(this.plugin.settings.boardZoom);
      zoomValueLabel.textContent = `${this.plugin.settings.boardZoom}%`;
    });

    let zoomPanelOpen = false;
    const openZoomPanel = (): void => {
      zoomPanelOpen = true;
      zoomSlider.value = String(this.plugin.settings.boardZoom);
      zoomValueLabel.textContent = `${this.plugin.settings.boardZoom}%`;
      zoomPanel.style.display = "flex";
    };
    const closeZoomPanel = (): void => {
      zoomPanelOpen = false;
      zoomPanel.style.display = "none";
    };

    this.zoomIndicatorEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (zoomPanelOpen) closeZoomPanel(); else openZoomPanel();
    });

    // パネル外クリックで閉じる
    this.registerDomEvent(document, "click", (e) => {
      if (!zoomWrapper.contains(e.target as Node)) closeZoomPanel();
    });
  }

  /**
   * フィルタパネル（独自ドロップダウン）
   * Obsidian Menu は選択で即閉じるため、複数選択できる独自実装にする
   */
  private buildFilterPanel(
    cls: string,
    label: string,
    key: "characters" | "locations"
  ): void {
    const wrapper = this.toolbarEl.createDiv({ cls: "ntj-filter-wrapper" });
    const btn = wrapper.createEl("button", { cls: `ntj-btn ${cls}`, text: label });

    const panel = wrapper.createDiv({ cls: "ntj-filter-panel" });
    panel.style.display = "none";

    let isOpen = false;

    const openPanel = () => {
      isOpen = true;
      panel.empty();
      const allValues = key === "characters"
        ? this.filterEngine.allCharacters(this.eventStore.getAll())
        : this.filterEngine.allLocations(this.eventStore.getAll());

      if (allValues.length === 0) {
        panel.createEl("div", { cls: "ntj-filter-empty", text: "（なし）" });
      } else {
        for (const value of allValues) {
          const item = panel.createDiv({ cls: "ntj-filter-item" });
          const set  = this.filterState[key] as Set<string>;
          const cb   = item.createEl("input", { type: "checkbox" });
          cb.checked = set.has(value);
          item.createSpan({ text: value });
          cb.addEventListener("change", () => {
            if (cb.checked) set.add(value); else set.delete(value);
            btn.toggleClass("is-active", set.size > 0);
            this.scheduleRender();
            // パネルは閉じない（複数選択できるよう維持）
          });
          item.addEventListener("click", (e) => {
            if (e.target === cb) return;
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event("change"));
          });
        }

        // クリアボタン
        const clearRow = panel.createDiv({ cls: "ntj-filter-clear-row" });
        const clearBtn = clearRow.createEl("button", { cls: "ntj-sf-btn", text: "クリア" });
        clearBtn.addEventListener("click", () => {
          (this.filterState[key] as Set<string>).clear();
          btn.removeClass("is-active");
          this.scheduleRender();
          openPanel(); // チェックボックスをリセット
        });
      }

      panel.style.display = "block";
    };

    const closePanel = () => {
      isOpen = false;
      panel.style.display = "none";
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) { closePanel(); } else { openPanel(); }
    });

    // パネル外クリックで閉じる
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target as Node)) closePanel();
    });
  }

  // ----------------------------------------------------------
  // 初回ロード
  // ----------------------------------------------------------

  private async loadAll(): Promise<void> {
    await this.cacheStore.load();
    const result = await this.discovery.discoverAll();

    this.eventStore.clear();
    for (const event of result.events) {
      this.eventStore.upsert(event);
      this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
    }

    await this.cacheStore.save();
    this.filterEngine.buildIndex(this.eventStore.getAll());
    this.scheduleRender();

    // 初期表示：左上（最も過去の日付・レーン1）を起点に表示する
    requestAnimationFrame(() => {
      this.timelineEl.scrollLeft = 0;
      this.timelineEl.scrollTop  = 0;
    });
  }

  // ----------------------------------------------------------
  // File Watch（差分更新）
  // ----------------------------------------------------------

  private registerFileWatcher(): void {
    const vault         = this.plugin.app.vault;
    const metadataCache = this.plugin.app.metadataCache;

    // 作成・更新の検知は vault "create"/"modify" ではなく
    // metadataCache "changed" を使う。
    // フロントマターがデータの実体になったため、Obsidian がフロントマターの
    // 再パースを終えたタイミング（＝このイベントの発火時）で読む必要がある。
    // vault "modify" 直後は metadataCache の再パースが間に合わず、
    // 古いフロントマターを読んでしまう競合が起こり得るため使用しない。
    this.registerEvent(metadataCache.on("changed", (file, _data, cache) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      const event = this.discovery.buildEventFromCache(file, cache);
      if (event) {
        this.eventStore.upsert(event);
        this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
      } else {
        this.eventStore.deleteByFilePath(file.path);
      }
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));

    this.registerEvent(vault.on("rename", async (file, oldPath) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.eventStore.deleteByFilePath(oldPath);
      const event = await this.discovery.discoverFile(file);
      if (event) {
        this.eventStore.upsert(event);
        this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
      }
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));

    this.registerEvent(vault.on("delete", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.eventStore.deleteByFilePath(file.path);
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));
  }

  // ----------------------------------------------------------
  // 描画スケジューラ
  // ★ デバウンス 50ms（16ms は短すぎてホイール連打で詰まる）
  // ----------------------------------------------------------

  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.doRender(), 50);
  }

  private doRender(): void {
    const t0        = performance.now();
    const settings  = this.plugin.settings;
    const allEvents = this.eventStore.getAllSorted();

    // エラーイベント（日付不正）は表示しない・Gap計算にも含めない
    const validEvents = allEvents.filter(e => !e.error);

    const filtered    = this.filterEngine.apply(validEvents, this.filterState);
    const filteredIds = filtered.length < validEvents.length
      ? new Set(filtered.map((e) => e.id))
      : null;

    // ── Gap・X座標の正しい計算順序（時間軸は横軸）──
    // Step1: Gap情報なしで暫定X座標を計算（Gap生成に使う）
    const tempXMap = this.layoutEngine.calcXPositions(
      validEvents, [], settings.gapCompression
    );
    // Step2: 暫定X座標でGap一覧を生成（expanded状態を保持）
    this.gaps = settings.gapCompression
      ? this.gapEngine.buildGaps(validEvents, tempXMap, settings.gapThreshold)
      : [];

    // Step3: ノード配置（確定した gaps を使って正式X座標を計算する）
    this.nodes = this.layoutEngine.buildLayout(
      validEvents, LANES_START_Y, this.gaps, settings.gapCompression
    );

    // Step4: 確定した LayoutNode（実際の描画幅を含む）でGapの表示位置を更新する
    this.gapEngine.updateGapYPositions(this.gaps, this.nodes);

    const totalWidth = this.layoutEngine.calcTotalWidth(this.nodes);
    const edges       = this.relationEngine.buildEdges(validEvents, this.nodes);

    // ボードズームは timelineEl の子（zoomWrapperEl）にのみ CSS zoom で適用しているため、
    // timelineEl 自身の scrollLeft/scrollTop/clientWidth/clientHeight は
    // 「ズーム後」の実座標系になっている。SVGユーザー座標（ズーム前）と揃えるため
    // ズーム倍率で割り戻す。
    const zoomFactor = this.plugin.settings.boardZoom / 100;
    const virtualWindow: VirtualWindow = {
      scrollTop:      this.timelineEl.scrollTop  / zoomFactor,
      scrollLeft:     this.timelineEl.scrollLeft / zoomFactor,
      viewportHeight: this.timelineEl.clientHeight / zoomFactor,
      viewportWidth:  this.timelineEl.clientWidth  / zoomFactor,
      buffer:         settings.renderBuffer / zoomFactor,
    };

    this.renderer.render({
      nodes:        this.nodes,
      gaps:         this.gaps,
      edges,
      filteredIds,
      selectedId:   this.selectedId,
      settings,
      totalWidth,
      virtualWindow,
      dateRows:     this.buildDateRows(validEvents, this.nodes),
      onNodeClick:   (event, _node, mx, my) => { void this.handleNodeClick(event, mx, my); },
      onNodeHover:   () => { /* Tooltip は Renderer 内で処理済み */ },
      onNodeLeave:   () => { /* Tooltip hide は Renderer 内で処理済み */ },
      onGapClick:    (gap) => this.handleGapClick(gap),
      onContextMenu: (svgX, mx, my, lane) => this.handleContextMenu(svgX, mx, my, lane),
      onLaneDrop:    (eventId, targetLane) => this.handleLaneDrop(eventId, targetLane),
      resolveNodeColors: (event) => this.plugin.colorPresetStore.resolve(event.color),
    });

    // テーブルビューも最新データで更新（表示中かどうかに関わらず）
    const tableEvents = filtered.length < validEvents.length ? filtered : validEvents;
    this.tableView.render(tableEvents, (filePath) => {
      const file = this.plugin.app.vault.getFileByPath(filePath);
      if (file) this.plugin.app.workspace.getLeaf(false).openFile(file);
    });

    const t1 = performance.now();
    this.updateDebugOverlay(validEvents.length, this.nodes.length, this.gaps.length, t1 - t0);
  }

  // ----------------------------------------------------------
  // デバッグオーバーレイ
  // ----------------------------------------------------------

  private updateDebugOverlay(
    eventCount: number,
    nodeCount:  number,
    gapCount:   number,
    renderMs:   number
  ): void {
    const isDebug = this.plugin.settings.debugMode;
    this.debugOverlay.style.display = isDebug ? "block" : "none";
    if (!isDebug) return;

    this.debugOverlay.innerHTML = [
      `events:  ${eventCount}`,
      `nodes:   ${nodeCount}`,
      `gaps:    ${gapCount}`,
      `render:  ${renderMs.toFixed(1)}ms`,
      `scroll:  ${this.timelineEl.scrollTop.toFixed(0)}px`,
      `zoom:    ${this.plugin.settings.boardZoom}%`,
    ].join("<br>");
  }

  // ----------------------------------------------------------
  // ビューモード切替（タイムライン ↔ テーブル）
  // ----------------------------------------------------------

  private toggleViewMode(): void {
    if (this.viewMode === "timeline") {
      this.viewMode = "table";
      this.timelineEl.style.display       = "none";
      this.tableContainerEl.style.display = "flex";
      this.viewModeBtn.textContent        = "タイムライン表示";
      this.viewModeBtn.addClass("is-active");
    } else {
      this.viewMode = "timeline";
      this.timelineEl.style.display       = "";
      this.tableContainerEl.style.display = "none";
      this.viewModeBtn.textContent        = "一覧表示";
      this.viewModeBtn.removeClass("is-active");
    }
  }

  // ----------------------------------------------------------
  // インタラクション
  // ----------------------------------------------------------

  private async handleNodeClick(event: TimelineEvent, _mouseX: number, _mouseY: number): Promise<void> {
    // 計測モード中はノードクリックを計測専用の処理へ渡し、
    // 通常のサイドバー編集は開かない
    if (this.measureMode) {
      this.handleMeasureNodeClick(event);
      return;
    }

    this.selectedId = this.selectedId === event.id ? null : event.id;
    this.scheduleRender();
    // 右サイドバーで編集画面を開く
    const sidebar = await this.plugin.getOrOpenSidebarView();
    sidebar?.showViewEdit(event);
  }

  // ----------------------------------------------------------
  // ノード間日数計測
  // ----------------------------------------------------------

  /** 計測モードを開始する（始点ノード待ち状態にする） */
  private startMeasureMode(): void {
    this.measureMode       = true;
    this.measureStartEvent = null;
    this.selectedId        = null;
    this.timelineEl.addClass("is-measuring");
    this.scheduleRender();
    new Notice("ノード間日数計測: 始点ノードをクリックしてください（Escで中止）");
  }

  /** 計測モードを中止し、通常状態へ戻す */
  private cancelMeasureMode(): void {
    this.measureMode       = false;
    this.measureStartEvent = null;
    this.selectedId        = null;
    this.timelineEl.removeClass("is-measuring");
    this.scheduleRender();
    new Notice("ノード間日数計測を中止しました");
  }

  /**
   * 計測モード中のノードクリックを処理する。
   * 1回目のクリック → 始点として記録し、終点待ちにする。
   * 2回目のクリック → 終点として確定し、結果モーダルを表示する。
   */
  private handleMeasureNodeClick(event: TimelineEvent): void {
    if (!this.measureStartEvent) {
      this.measureStartEvent = event;
      this.selectedId = event.id;
      this.scheduleRender();
      new Notice(`始点: ${event.displayTitle} — 終点ノードをクリックしてください（Escで中止）`);
      return;
    }

    // 同じノードを終点に選んだ場合は無視し、終点選択を継続する
    if (event.id === this.measureStartEvent.id) {
      new Notice("始点と同じノードです。別のノードを終点として選択してください");
      return;
    }

    const startEvent = this.measureStartEvent;
    const endEvent    = event;

    this.measureMode       = false;
    this.measureStartEvent = null;
    this.selectedId        = null;
    this.timelineEl.removeClass("is-measuring");
    this.scheduleRender();

    this.showMeasureResult(startEvent, endEvent);
  }

  /** 2イベント間の日数を算出し、結果モーダルを表示する */
  private showMeasureResult(startEvent: TimelineEvent, endEvent: TimelineEvent): void {
    const dateParser = new DateParser(this.plugin.settings.calendar);

    const startParsed = dateParser.parse(startEvent.date);
    const endParsed    = dateParser.parse(endEvent.date);

    const startDateLabel = startParsed.ok ? dateParser.format(startParsed.parsed) : startEvent.date;
    const endDateLabel    = endParsed.ok   ? dateParser.format(endParsed.parsed)   : endEvent.date;

    // timelineOrder は「日数相当値」なので、差分がそのまま日数差になる
    const diffDays  = endEvent.timelineOrder - startEvent.timelineOrder;
    const diffLabel = this.gapEngine.formatDiff(Math.abs(diffDays));

    new MeasureModal(this.app, {
      startTitle: startEvent.displayTitle,
      startDateLabel,
      endTitle: endEvent.displayTitle,
      endDateLabel,
      diffDays,
      diffLabel,
    }).open();
  }

  private handleGapClick(gap: GapSegment): void {
    this.gapEngine.toggleExpand(gap);
    this.scheduleRender();
  }

  private handleContextMenu(svgX: number, mouseX: number, mouseY: number, lane: number): void {
    const settings  = this.plugin.settings;

    // svgX は clientXToSvgX() で変換済みのSVGユーザー座標（ボードズーム考慮済み）。
    const dateStr = this.layoutEngine.orderFromViewportX(
      svgX, this.nodes, this.gaps, settings.gapCompression, ""
    );

    const menu = new Menu();

    // 新規イベント作成
    menu.addItem((item) => {
      item.setTitle("新規イベントを作成");
      item.setIcon("file-plus");
      item.onClick(async () => {
        const sidebar = await this.plugin.getOrOpenSidebarView();
        sidebar?.showCreate(dateStr, lane);
      });
    });

    // ノード間日数計測
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("ノード間日数計測");
      item.setIcon("ruler");
      item.onClick(() => {
        this.startMeasureMode();
      });
    });

    // Gap 操作（Gap が存在する場合のみ表示）
    if (settings.gapCompression && this.gaps.length > 0) {
      menu.addSeparator();

      menu.addItem((item) => {
        item.setTitle("Gapをすべて展開");
        item.setIcon("chevrons-down-up");
        item.onClick(() => {
          this.gapEngine.expandAll(this.gaps);
          this.scheduleRender();
        });
      });

      menu.addItem((item) => {
        item.setTitle("Gapをすべて折りたたむ");
        item.setIcon("chevrons-up-down");
        item.onClick(() => {
          this.gapEngine.collapseAll();
          this.scheduleRender();
        });
      });
    }

    menu.showAtPosition({ x: mouseX, y: mouseY });
  }

  private async handleLaneDrop(eventId: string, targetLane: number): Promise<void> {
    const event = this.eventStore.getById(eventId);
    if (!event) return;

    // 1〜10 の範囲にクランプ
    const newLane = Math.max(LANE_MIN, Math.min(LANE_MAX, targetLane));

    // 変化なしなら何もしない
    if (newLane === event.lane) return;

    // EventStore を更新
    const updated = { ...event, lane: newLane };
    this.eventStore.upsert(updated);

    // フロントマター（NTJP_lane）に書き込む
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (file) {
      try {
        await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
          fm[NTJP_KEYS.lane] = newLane;
        });
      } catch (e) {
        new Notice(`laneの保存に失敗しました: ${(e as Error).message}`);
      }
    }

    this.scheduleRender();
  }

  // ----------------------------------------------------------
  // 外部 API
  // ----------------------------------------------------------

  /**
   * 時間軸に描画する日付行リストを生成する。
   * 同日のノードが複数あっても1行にまとめる。
   * 年・月・日・暦プレフィックスをパースして DateRow を返す。
   */
  private buildDateRows(
    sortedEvents: TimelineEvent[],
    nodes: LayoutNode[]
  ): DateRow[] {
    if (sortedEvents.length === 0) return [];

    const dateParser  = new DateParser(this.plugin.settings.calendar);
    const nodeXMap    = new Map<string, number>();
    for (const node of nodes) {
      nodeXMap.set(node.event.id, node.x);
    }

    // timelineOrder → { y, parsed } の重複排除マップ
    const seenOrders = new Map<number, DateRow>();
    // 暦名は設定から取得（イベントのdate文字列には暦名を含めない仕様）
    const calendarPrefix = this.plugin.settings.calendar.name ?? "";

    for (const event of sortedEvents) {
      if (seenOrders.has(event.timelineOrder)) continue;

      const result = dateParser.parse(event.date);
      if (!result.ok) continue;

      const { year, month, day } = result.parsed;
      const monthDef   = getMonthDef(this.plugin.settings.calendar, month);
      const monthLabel = monthDef && monthDef.name.trim() !== ""
        ? monthDef.name
        : `${month}月`;

      const x = nodeXMap.get(event.id) ?? 0;

      seenOrders.set(event.timelineOrder, {
        x, year, month, day, monthLabel, calendarPrefix,
      });
    }

    return Array.from(seenOrders.values()).sort((a, b) => a.x - b.x);
  }

  async rebuildAll(): Promise<void> {
    await this.cacheStore.clearAll();
    await this.loadAll();
  }

  refreshSettings(): void {
    const { settings } = this.plugin;
    this.discovery.updateCalendar(settings.calendar);
    this.discovery.updateExcludedFolders(settings.excludedFolders);
    this.layoutEngine.updateCalendar(settings.calendar);
    this.gapEngine.updateCalendar(settings.calendar);
    this.scheduleRender();
  }
}
