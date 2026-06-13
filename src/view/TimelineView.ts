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
import { LayoutEngine }     from "../engine/LayoutEngine";
import { RelationEngine }   from "../engine/RelationEngine";
import { GapEngine }        from "../engine/GapEngine";
import { FilterEngine }     from "../engine/FilterEngine";
import { TimelineRenderer, DateRow } from "./TimelineRenderer";
import { DateParser } from "../parser/DateParser";
import { getMonthDef } from "../settings/PluginSettings";

import {
  TimelineEvent,
  LayoutNode,
  GapSegment,
  FilterState,
  VirtualWindow,
} from "../types/TimelineTypes";

import type NovelsTimelinePlugin from "../main";

export const TIMELINE_VIEW_TYPE = "novels-timeline-jp";

const LANE_MIN = -10;
const LANE_MAX =  10;

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

  private filterState: FilterState = {
    characters:  new Set(),
    locations:   new Set(),
    searchQuery: "",
  };

  private toolbarEl!:    HTMLElement;
  private timelineEl!:   HTMLElement;
  private searchInput!:  HTMLInputElement;
  private debugOverlay!: HTMLElement;

  // タイマーID
  private renderTimer:    ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NovelsTimelinePlugin) {
    super(leaf);
    this.plugin = plugin;

    const { app, settings } = plugin;
    this.eventStore     = new EventStore();
    this.cacheStore     = new CacheStore(app);
    this.discovery      = new DiscoveryEngine(app.vault, settings.calendar, settings.excludedFolders);
    this.layoutEngine   = new LayoutEngine(settings.calendar);
    this.relationEngine = new RelationEngine();
    this.gapEngine      = new GapEngine(settings.calendar);
    this.filterEngine   = new FilterEngine();
  }

  getViewType():    string { return TIMELINE_VIEW_TYPE; }
  getDisplayText(): string { return "Novels Timeline JP"; }
  getIcon():        string { return "book-open"; }

  async onOpen(): Promise<void> {
    await this.buildUI();
    await this.loadAll();
    this.registerFileWatcher();
  }

  async onClose(): Promise<void> {
    // タイマーをすべてクリア（フリーズ防止）
    if (this.renderTimer)   clearTimeout(this.renderTimer);
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
    this.renderer   = new TimelineRenderer(this.timelineEl);

    this.debugOverlay = this.timelineEl.createDiv({ cls: "ntj-debug-overlay" });
    this.debugOverlay.style.display = "none";

    // スクロール → 再描画（仮想描画更新 + ルーラー位置更新）
    this.timelineEl.addEventListener("scroll", () => this.scheduleRender());

    // Ctrl+ホイール → 左右スクロール
    this.timelineEl.addEventListener("wheel", (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // deltaY を横スクロール量として使用（1ステップ=60px）
      const delta = e.deltaY > 0 ? 60 : -60;
      this.timelineEl.scrollLeft += delta;
    }, { passive: false });

    // ドラッグパン（上下左右）
    // ノードのドラッグ（lane変更）と区別するため、SVG背景上のみ反応させる
    this.registerPanEvents();
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

    // 初期表示：横スクロールを中央（時間軸が画面中心）に合わせる
    // SVG幅: 40*10*2 + 40*3 = 920, centerX = 460
    // timelineElの幅の半分だけ左にスクロールして中央に位置合わせ
    requestAnimationFrame(() => {
      const LANE_W   = 40;
      const AXIS_W   = LANE_W * 2;
      const LANES    = 10;
      const svgWidth = LANE_W * LANES + AXIS_W + LANE_W * LANES;
      const centerX  = LANE_W * LANES + AXIS_W / 2;
      const viewW    = this.timelineEl.clientWidth;
      this.timelineEl.scrollLeft = centerX - Math.floor(viewW / 2);
    });
  }

  // ----------------------------------------------------------
  // File Watch（差分更新）
  // ----------------------------------------------------------

  private registerFileWatcher(): void {
    const vault = this.plugin.app.vault;

    this.registerEvent(vault.on("create", async (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      const event = await this.discovery.discoverFile(file);
      if (!event) return;
      this.eventStore.upsert(event);
      this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));

    this.registerEvent(vault.on("modify", async (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      const event = await this.discovery.discoverFile(file);
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

    // SVG幅・centerX（Rendererと同じ計算式）
    const LANE_W   = 40;
    const AXIS_W   = LANE_W * 2;
    const LANES    = 10;
    const svgWidth = LANE_W * LANES + AXIS_W + LANE_W * LANES; // 880px
    const centerX  = LANE_W * LANES + AXIS_W / 2;              // 440px

    // ── Gap・Y座標の正しい計算順序 ──
    // Step1: Gap情報なしで暫定Y座標を計算（Gap生成に使う）
    const tempYMap = this.layoutEngine.calcYPositions(
      validEvents, [], settings.gapCompression
    );
    // Step2: 暫定Y座標でGap一覧を生成（expanded状態を保持）
    this.gaps = settings.gapCompression
      ? this.gapEngine.buildGaps(validEvents, tempYMap, settings.gapThreshold)
      : [];
    // Step3: Gap考慮済みの正式Y座標を再計算
    const finalYMap = this.layoutEngine.calcYPositions(
      validEvents, this.gaps, settings.gapCompression
    );
    // Step4: GapのY座標を正式Y（前後イベントの中間）で更新
    this.gapEngine.updateGapYPositions(this.gaps, finalYMap, validEvents);

    // Step5: ノード配置（validEventsのみ・正式GapでY計算）
    this.nodes = this.layoutEngine.buildLayout(
      validEvents, centerX, settings.nodeScale / 100,
      this.gaps, settings.gapCompression
    );

    const totalHeight = this.layoutEngine.calcTotalHeight(this.nodes);
    const edges       = this.relationEngine.buildEdges(validEvents, this.nodes);

    const virtualWindow: VirtualWindow = {
      scrollTop:      this.timelineEl.scrollTop,
      scrollLeft:     this.timelineEl.scrollLeft,
      viewportHeight: this.timelineEl.clientHeight,
      viewportWidth:  this.timelineEl.clientWidth,
      buffer:         settings.renderBuffer,
    };

    this.renderer.render({
      nodes:        this.nodes,
      gaps:         this.gaps,
      edges,
      filteredIds,
      selectedId:   this.selectedId,
      settings,
      centerX,
      totalHeight,
      virtualWindow,
      dateRows:     this.buildDateRows(validEvents, this.nodes),
      onNodeClick:   (event, _node, mx, my) => { void this.handleNodeClick(event, mx, my); },
      onNodeHover:   () => { /* Tooltip は Renderer 内で処理済み */ },
      onNodeLeave:   () => { /* Tooltip hide は Renderer 内で処理済み */ },
      onGapClick:    (gap) => this.handleGapClick(gap),
      onContextMenu: (svgY, mx, my) => this.handleContextMenu(svgY, mx, my),
      onLaneDrop:    (eventId, laneShift) => this.handleLaneDrop(eventId, laneShift),
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
      `scale:   ${this.plugin.settings.nodeScale}%`,
    ].join("<br>");
  }

  // ----------------------------------------------------------
  // インタラクション
  // ----------------------------------------------------------

  private async handleNodeClick(event: TimelineEvent, _mouseX: number, _mouseY: number): Promise<void> {
    this.selectedId = this.selectedId === event.id ? null : event.id;
    this.scheduleRender();
    // 右サイドバーで編集画面を開く
    const sidebar = await this.plugin.getOrOpenSidebarView();
    sidebar?.showViewEdit(event);
  }

  private handleGapClick(gap: GapSegment): void {
    this.gapEngine.toggleExpand(gap);
    this.scheduleRender();
  }

  private handleContextMenu(svgY: number, mouseX: number, mouseY: number): void {
    const settings  = this.plugin.settings;

    // e.offsetY（SVGユーザー座標）をそのまま渡す。
    // node.y も同じSVGユーザー座標なので変換不要。
    const dateStr = this.layoutEngine.orderFromViewportY(
      svgY, this.nodes, this.gaps, settings.gapCompression, ""
    );

    const menu = new Menu();

    // 新規イベント作成
    menu.addItem((item) => {
      item.setTitle("新規イベントを作成");
      item.setIcon("file-plus");
      item.onClick(async () => {
        const sidebar = await this.plugin.getOrOpenSidebarView();
        sidebar?.showCreate(dateStr);
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

  private async handleLaneDrop(eventId: string, laneShift: number): Promise<void> {
    const event = this.eventStore.getById(eventId);
    if (!event) return;

    const newLane = Math.max(LANE_MIN, Math.min(LANE_MAX, event.lane + laneShift));
    if (newLane === event.lane) return;

    const updated = { ...event, lane: newLane };
    this.eventStore.upsert(updated);

    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (file) {
      try {
        const content    = await this.plugin.app.vault.read(file);
        const newContent = this.rewriteLaneInContent(content, newLane);
        if (newContent !== content) {
          await this.plugin.app.vault.modify(file, newContent);
        }
      } catch (e) {
        new Notice(`laneの保存に失敗しました: ${(e as Error).message}`);
      }
    }

    this.scheduleRender();
  }

  /**
   * Markdown 本文中の timelineブロック内の lane: を書き換える。
   * - ``` または ```` で囲まれた timeline ブロックに対応
   * - ブロック内の最初の lane: のみ書き換える
   */
  private rewriteLaneInContent(content: string, newLane: number): string {
    // timelineブロックの開始〜終了を抽出して lane: を置換
    return content.replace(
      /(^`{3,}novels_timeline_jp\s*$)([\s\S]*?)(^`{3,}\s*$)/m,
      (_match, open, body, close) => {
        const newBody = body.replace(
          /^(lane\s*:\s*)(-?\d+)/m,
          `$1${newLane}`
        );
        return open + newBody + close;
      }
    );
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
    const nodeYMap    = new Map<string, number>();
    for (const node of nodes) {
      nodeYMap.set(node.event.id, node.y);
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

      const y = nodeYMap.get(event.id) ?? 0;

      seenOrders.set(event.timelineOrder, {
        y, year, month, day, monthLabel, calendarPrefix,
      });
    }

    return Array.from(seenOrders.values()).sort((a, b) => a.y - b.y);
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
