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
import { LayoutEngine, LANE_MIN, HEADER_H, LANES_START_X, AXIS_X } from "../engine/LayoutEngine";
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

/** 矢印キーによるフォーカス移動シーケンスの1要素（ノードまたはGap） */
interface FocusItem {
  type: "node" | "gap";
  /** node: event.id / gap: `${fromOrder}:${toOrder}`（TimelineRendererのdata属性と一致させる） */
  id: string;
  y: number;
  x: number;
}

/** フォーカス対象の種別とIDのみを表す（doRender()での再フォーカス復元用） */
type FocusRef = Pick<FocusItem, "type" | "id">;

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

  // ── キーボード操作（矢印キー）でのフォーカス移動 ──
  // 仮想描画により画面外の要素はDOMに存在しないため、Tabキーによる
  // ネイティブなフォーカス移動では画面外へ辿り着けない。
  // そこで Tab はタイムライン全体（timelineEl）へ一度だけ入る操作とし、
  // 領域内では ↑/↓（Home/End）キーで時系列順に1件ずつフォーカスを移動する。
  // 移動先が画面外の場合は自動スクロール→再描画してからフォーカスする。
  private focusSequence:   FocusItem[] = [];
  private focusedItemType: "node" | "gap" | null = null;
  private focusedItemId:   string | null = null;
  // マウス操作（左クリック/右クリック問わず）によってtimelineEl自身へネイティブに
  // フォーカスが移る際に一時的に立てるフラグ。これが立っている間は「focus」イベント
  // 側での自動フォーカス委譲（＝直近アイテムへスクロール移動）を行わない。
  // 未設定だと、レーン背景の空白部分をクリック（右クリックの文脈メニュー表示も含む）
  // しただけで直近アイテムへ勝手にスクロールしてしまい、右クリックメニューの表示位置が
  // ずれる不具合が発生する。
  private suppressFocusDelegation = false;

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
  private characterFilterApi!: { addValue: (value: string) => void };
  private locationFilterApi!:  { addValue: (value: string) => void };

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
  getDisplayText(): string {
    const calendarName = this.plugin.settings.calendar.name?.trim();
    return calendarName ? `${calendarName} - Novels Timeline JP` : "Novels Timeline JP";
  }
  getIcon():        string { return "timeline"; }

  /**
   * タブのタイトル表示を最新の getDisplayText() で更新する。
   * Obsidian は暦名変更のような内部状態変化を自動検知しないため、
   * 明示的に呼び出してタブヘッダーを再描画させる必要がある。
   * updateHeader() は型定義に含まれないランタイムAPIのため any 経由で呼ぶ。
   */
  private updateTabTitle(): void {
    (this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
  }

  /** 現在保持している全イベントを返す（EventSidebarView の関連イベント選択などから使用） */
  getAllEvents(): TimelineEvent[] {
    return this.eventStore.getAll();
  }

  async onOpen(): Promise<void> {
    await this.buildUI();
    await this.loadAll();
    this.registerFileWatcher();
    this.updateTabTitle();
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
    // キーボード操作対応: Tabではここへ一度だけ入り、↑/↓（Home/End）で
    // イベント・GAPを時系列順に1件ずつフォーカス移動する（ロービングフォーカス）。
    this.timelineEl.setAttribute("tabindex", "0");
    this.timelineEl.setAttribute("role", "application");
    this.timelineEl.setAttribute(
      "aria-label",
      "タイムライン。上下矢印キーでイベント・GAPを移動、Enterキーで詳細を表示します。"
    );

    // ズームラッパー：この要素にのみ CSS zoom を適用し、
    // ボード（スクロール範囲）全体を拡大縮小する。
    // デバッグオーバーレイはこの外側（timelineEl直下）に置き、ズームの影響を受けない。
    this.zoomWrapperEl = this.timelineEl.createDiv({ cls: "ntj-timeline-zoom-wrapper" });
    this.renderer = new TimelineRenderer(this.zoomWrapperEl);
    this.applyBoardZoom();

    this.tableContainerEl = root.createDiv({ cls: "ntj-table-container" });
    this.tableView = new TableView(this.tableContainerEl);

    this.debugOverlay = this.timelineEl.createDiv({ cls: "ntj-debug-overlay" });

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

    // マウスの mousedown はフォーカス移動より必ず先に発生するため、ここでフラグを
    // 立てておくことで、直後に発火する「focus」がマウス起因かどうかを判別する。
    // 右クリック（contextmenu）も mousedown を伴うためこれで検知できる。
    this.registerDomEvent(this.timelineEl, "mousedown", () => {
      this.suppressFocusDelegation = true;
      // 万一「focus」が発火しないケース（すでにtimelineElへフォーカス済み等）に
      // 備えて、フラグが残り続けないよう次のタスクでリセットしておく。
      setTimeout(() => { this.suppressFocusDelegation = false; }, 0);
    });

    // Tabキーでコンテナ自身にフォーカスが入った瞬間: 直前にフォーカスしていた
    // アイテムがあればそこへ、無ければ現在のスクロール位置に最も近いアイテムへ
    // フォーカスを委譲する（focusイベントはbubbleしないため、ここではtimelineEl
    // 自身がフォーカスされた場合のみ発火する＝ノード/Gap自身へのfocus()では発火しない）。
    // ただし、マウス操作（クリック・右クリック）による場合は委譲しない。
    // 委譲してしまうと、レーン背景の空白部分をクリックしただけで直近アイテムへ
    // 勝手にスクロールし、右クリックメニューの表示位置がずれる等の問題が起きる。
    this.registerDomEvent(this.timelineEl, "focus", () => {
      if (this.suppressFocusDelegation) {
        this.suppressFocusDelegation = false;
        return;
      }
      if (this.focusSequence.length === 0) return;
      let idx = this.focusSequence.findIndex(
        (it) => it.type === this.focusedItemType && it.id === this.focusedItemId
      );
      if (idx === -1) idx = this.nearestFocusIndexToScroll();
      this.moveFocusToIndex(idx);
    });

    // ↑/↓: 時系列順に1件移動、Home/End: 先頭/末尾へ移動
    this.registerDomEvent(this.timelineEl, "keydown", (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          this.moveFocusBy(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          this.moveFocusBy(-1);
          break;
        case "Home":
          e.preventDefault();
          this.moveFocusToIndex(0);
          break;
        case "End":
          e.preventDefault();
          this.moveFocusToIndex(this.focusSequence.length - 1);
          break;
      }
    });

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
    // 50%〜300%の連続値（ユーザー設定/スライダー由来）のため、
    // 固定のCSSクラスでは表現できない。インラインスタイルによる指定を許容する。
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
      el.toggleClass("is-panning", true);
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
      el.toggleClass("is-panning", false);
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
      clearBtn.toggleClass("is-visible", !!this.searchInput.value);
      this.scheduleRender();
    });
    const clearBtn = searchWrapper.createEl("button", { cls: "ntj-search-clear", text: "✕" });
    clearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.filterState.searchQuery = "";
      clearBtn.toggleClass("is-visible", false);
      this.scheduleRender();
      this.searchInput.focus();
    });

    // ─── 人物フィルタ ───
    this.characterFilterApi = this.buildFilterPanel("ntj-filter-characters", "登場人物 ▼", "characters");

    // ─── 場所フィルタ ───
    this.locationFilterApi = this.buildFilterPanel("ntj-filter-locations", "場所 ▼", "locations");

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
      text: "テーブル表示",
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
      zoomPanel.toggleClass("is-visible", true);
    };
    const closeZoomPanel = (): void => {
      zoomPanelOpen = false;
      zoomPanel.toggleClass("is-visible", false);
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
  ): { addValue: (value: string) => void } {
    const wrapper = this.toolbarEl.createDiv({ cls: "ntj-filter-wrapper" });
    const btn = wrapper.createEl("button", { cls: `ntj-btn ${cls}`, text: label });

    const panel = wrapper.createDiv({ cls: "ntj-filter-panel" });

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

      panel.toggleClass("is-visible", true);
    };

    const closePanel = () => {
      isOpen = false;
      panel.toggleClass("is-visible", false);
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) { closePanel(); } else { openPanel(); }
    });

    // パネル外クリックで閉じる
    // registerDomEvent() を使うことで、ビューが閉じられた際に
    // Obsidian 側で自動的にリスナーが解除される
    // （buildFilterPanel は人物/場所の2回呼ばれるため、生の
    // document.addEventListener だとビューを開閉するたびに
    // リスナーが蓄積してしまう）。
    this.registerDomEvent(document, "click", (e) => {
      if (!wrapper.contains(e.target as Node)) closePanel();
    });

    /**
     * 外部（テーブル表示の登場人物/場所タグなど）から値を選択状態にする。
     * 既に選択済みの場合は何もしない（トグルではなく「選択状態にする」動作）。
     */
    const addValue = (value: string) => {
      const set = this.filterState[key] as Set<string>;
      if (!set.has(value)) {
        set.add(value);
        btn.toggleClass("is-active", set.size > 0);
        this.scheduleRender();
      }
      // パネルが開いていればチェック状態を反映して再描画する
      if (isOpen) openPanel();
    };

    return { addValue };
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

    // 再描画のたびにSVG内の要素はすべて作り直される（TimelineRenderer.render()が
    // 毎回丸ごと再構築する実装のため）。そのままではキーボードでフォーカス中の
    // 要素も消えてしまい、フォーカスが失われる（特に、矢印キー移動時の自動スクロール
    // がscrollイベント→scheduleRender()経由の再描画を誘発するケースで顕著）。
    // 再描画直前に「フォーカス中の要素」を種別・IDで記録しておき、再描画後に
    // 同じ対象（新しく作られたDOM要素）へfocus()し直すことでフォーカスを維持する。
    const activeEl = document.activeElement;
    let refocusTarget: FocusRef | null = null;
    if (activeEl instanceof Element && this.zoomWrapperEl.contains(activeEl)) {
      const eventId = activeEl.getAttribute("data-event-id");
      const gapId   = activeEl.getAttribute("data-gap-id");
      if (eventId)      refocusTarget = { type: "node", id: eventId };
      else if (gapId)   refocusTarget = { type: "gap",  id: gapId };
    }

    // エラーイベント（日付不正）は表示しない・Gap計算にも含めない
    const validEvents = allEvents.filter(e => !e.error);

    const filtered    = this.filterEngine.apply(validEvents, this.filterState);
    const filteredIds = filtered.length < validEvents.length
      ? new Set(filtered.map((e) => e.id))
      : null;

    // ── Gap・Y座標の正しい計算順序（時間軸は縦軸）──
    // Step1: Gap情報なしで暫定Y座標を計算（Gap生成に使う）
    const tempYMap = this.layoutEngine.calcYPositions(
      validEvents, [], settings.gapCompression
    );
    // Step2: 暫定Y座標でGap一覧を生成（expanded状態を保持）
    this.gaps = settings.gapCompression
      ? this.gapEngine.buildGaps(validEvents, tempYMap, settings.gapThreshold)
      : [];

    // Step3: ノード配置（確定した gaps を使って正式Y座標を計算する）
    this.nodes = this.layoutEngine.buildLayout(
      validEvents, settings.laneCount, this.gaps, settings.gapCompression
    );

    // Step4: 確定した LayoutNode でGapの表示位置を更新する
    this.gapEngine.updateGapYPositions(this.gaps, this.nodes);

    // 矢印キー移動用のフォーカスシーケンスを再構築する。
    // 仮想描画の対象外（画面外）のノード・GAPも含めた全件から作る点が重要
    // （this.nodes / this.gaps は仮想描画で間引かれる前の全件のため）。
    this.focusSequence = this.buildFocusSequence();

    const totalWidth  = this.layoutEngine.calcTotalWidth(settings.laneCount);
    const totalHeight = this.layoutEngine.calcTotalHeight(this.nodes);
    const edges        = this.relationEngine.buildEdges(validEvents, this.nodes);

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
      totalHeight,
      virtualWindow,
      dateRows:     this.buildDateRows(validEvents, this.nodes),
      onNodeClick:   (event, _node, mx, my) => { void this.handleNodeClick(event, mx, my); },
      onNodeHover:   () => { /* Tooltip は Renderer 内で処理済み */ },
      onNodeLeave:   () => { /* Tooltip hide は Renderer 内で処理済み */ },
      onGapClick:    (gap) => this.handleGapClick(gap),
      onContextMenu: (svgY, mx, my, lane) => this.handleContextMenu(svgY, mx, my, lane),
      onLaneDrop:    (eventId, targetLane) => this.handleLaneDrop(eventId, targetLane),
      resolveNodeColors: (event) => this.plugin.colorPresetStore.resolve(event.color),
    });

    // 再描画でDOM要素が作り直された後、記録しておいたフォーカス対象を復元する。
    // （対象が仮想描画の範囲外になった等で見つからない場合は静かに諦める＝
    //   focusRenderedItem() 内で存在チェック済み）
    if (refocusTarget) {
      this.focusRenderedItem(refocusTarget);
    }

    // テーブルビューも最新データで更新（表示中かどうかに関わらず）
    const tableEvents = filtered.length < validEvents.length ? filtered : validEvents;
    this.tableView.render(
      tableEvents,
      (filePath) => {
        const file = this.plugin.app.vault.getFileByPath(filePath);
        if (file) this.plugin.app.workspace.getLeaf(false).openFile(file);
      },
      (eventId)  => this.handleTableLinkClick(eventId),
      (name)     => this.characterFilterApi.addValue(name),
      (name)     => this.locationFilterApi.addValue(name)
    );

    const t1 = performance.now();
    this.updateDebugOverlay(validEvents.length, this.nodes.length, this.gaps.length, t1 - t0);
  }

  // ----------------------------------------------------------
  // 矢印キーによるフォーカス移動（仮想描画と両立するキーボード操作）
  // ----------------------------------------------------------

  /** ノード・GapをY座標（時系列）順に並べたフォーカス移動シーケンスを構築する */
  private buildFocusSequence(): FocusItem[] {
    const items: FocusItem[] = [];
    for (const node of this.nodes) {
      items.push({ type: "node", id: node.event.id, y: node.y, x: node.x });
    }
    for (const gap of this.gaps) {
      // TimelineRenderer側のdata-gap-id（`${fromOrder}:${toOrder}`）と一致させる
      items.push({ type: "gap", id: `${gap.fromOrder}:${gap.toOrder}`, y: gap.y, x: AXIS_X });
    }
    // Y座標（時系列）順。同Y（同日など）の場合はX座標順で安定させる。
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    return items;
  }

  /** 現在のフォーカス位置から指定方向へ1件移動する。未フォーカス時は現在のスクロール位置に最も近い項目から開始する */
  private moveFocusBy(direction: 1 | -1): void {
    if (this.focusSequence.length === 0) return;
    const currentIdx = this.focusSequence.findIndex(
      (it) => it.type === this.focusedItemType && it.id === this.focusedItemId
    );
    const nextIdx = currentIdx === -1
      ? this.nearestFocusIndexToScroll()
      : Math.max(0, Math.min(this.focusSequence.length - 1, currentIdx + direction));
    this.moveFocusToIndex(nextIdx);
  }

  /** 現在のスクロール位置（縦方向）に最も近いフォーカス項目のインデックスを返す */
  private nearestFocusIndexToScroll(): number {
    if (this.focusSequence.length === 0) return -1;
    const zoomFactor = this.plugin.settings.boardZoom / 100;
    const targetY = this.timelineEl.scrollTop / zoomFactor;
    let best = 0;
    let bestDiff = Infinity;
    this.focusSequence.forEach((item, i) => {
      const diff = Math.abs(item.y - targetY);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  }

  /**
   * 指定インデックスの項目へフォーカスを移動する。
   * 画面外（仮想描画バッファの外）にある場合は自動スクロールしたうえで
   * 同期的に再描画し、対応するDOM要素を探してフォーカスする。
   * （scheduleRender()の50msデバウンスを待つとフォーカスが遅延・消失するため、
   *   ここでは直接doRender()を呼ぶ）
   */
  private moveFocusToIndex(idx: number): void {
    if (idx < 0 || idx >= this.focusSequence.length) return;
    const item = this.focusSequence[idx];
    this.focusedItemType = item.type;
    this.focusedItemId   = item.id;

    this.scrollFocusItemIntoView(item);
    this.doRender();
    this.focusRenderedItem(item);
  }

  /** 項目が現在の表示範囲外（固定ヘッダー・固定左列に隠れる位置も含む）にある場合のみスクロールする */
  private scrollFocusItemIntoView(item: FocusItem): void {
    const zoomFactor = this.plugin.settings.boardZoom / 100;
    const margin      = 24;
    // 上部の固定ヘッダー行・左側の固定列（年/月/GAP）は常に表示内容の一部を覆うため、
    // その分を実効的な表示範囲から差し引いて計算する。
    const headerPx  = HEADER_H       * zoomFactor;
    const leftColPx = LANES_START_X  * zoomFactor;
    const itemH     = 24 * zoomFactor; // ノード/Gapのおおよその縦幅（余裕を見た概算値）

    const viewTop    = this.timelineEl.scrollTop;
    const viewBottom = viewTop + this.timelineEl.clientHeight;
    const itemTopPx    = item.y * zoomFactor;
    const itemBottomPx = itemTopPx + itemH;

    if (itemTopPx < viewTop + headerPx + margin) {
      this.timelineEl.scrollTop = Math.max(0, itemTopPx - headerPx - margin);
    } else if (itemBottomPx > viewBottom - margin) {
      this.timelineEl.scrollTop = itemBottomPx - this.timelineEl.clientHeight + margin;
    }

    const viewLeft  = this.timelineEl.scrollLeft;
    const viewRight = viewLeft + this.timelineEl.clientWidth;
    const itemXPx = item.x * zoomFactor;

    if (itemXPx < viewLeft + leftColPx + margin) {
      this.timelineEl.scrollLeft = Math.max(0, itemXPx - leftColPx - margin);
    } else if (itemXPx > viewRight - margin) {
      this.timelineEl.scrollLeft = itemXPx - this.timelineEl.clientWidth + margin;
    }
  }

  /** 再描画後のDOMから対象要素を探してフォーカスする */
  private focusRenderedItem(item: FocusRef): void {
    const selector = item.type === "node"
      ? `[data-event-id="${CSS.escape(item.id)}"]`
      : `[data-gap-id="${CSS.escape(item.id)}"]`;
    const el = this.zoomWrapperEl.querySelector<SVGElement & { focus?: () => void }>(selector);
    // スクロール直後で仮想描画のバッファ計算上、稀に対象が生成されない場合があるため
    // 要素の存在チェックを行う（例外にせず静かに諦める）
    if (el && typeof el.focus === "function") {
      el.focus({ preventScroll: true });
    }
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
    this.debugOverlay.toggleClass("is-visible", isDebug);
    if (!isDebug) return;

    const lines = [
      `events:  ${eventCount}`,
      `nodes:   ${nodeCount}`,
      `gaps:    ${gapCount}`,
      `render:  ${renderMs.toFixed(1)}ms`,
      `scroll:  ${this.timelineEl.scrollTop.toFixed(0)}px`,
      `zoom:    ${this.plugin.settings.boardZoom}%`,
    ];

    this.debugOverlay.empty();
    for (const line of lines) {
      this.debugOverlay.createDiv({ text: line });
    }
  }

  // ----------------------------------------------------------
  // ビューモード切替（タイムライン ↔ テーブル）
  // ----------------------------------------------------------

  private toggleViewMode(): void {
    if (this.viewMode === "timeline") {
      this.viewMode = "table";
      this.timelineEl.toggleClass("is-hidden", true);
      this.tableContainerEl.toggleClass("is-visible", true);
      this.viewModeBtn.textContent = "タイムライン表示";
      this.viewModeBtn.addClass("is-active");
    } else {
      this.viewMode = "timeline";
      this.timelineEl.toggleClass("is-hidden", false);
      this.tableContainerEl.toggleClass("is-visible", false);
      this.viewModeBtn.textContent = "テーブル表示";
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

  /**
   * テーブル表示の「関連イベント」タグをクリックした際、
   * 対象行がテーブル内に見つからなかった場合（絞り込みで除外されている等）の
   * フォールバック処理。行スクロール自体は TableView 内で完結する。
   */
  private handleTableLinkClick(eventId: string): void {
    new Notice(`「${eventId}」は現在の絞り込み条件により一覧に表示されていません。`);
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

  private handleContextMenu(svgY: number, mouseX: number, mouseY: number, lane: number): void {
    const settings  = this.plugin.settings;

    // svgY は clientYToSvgY() で変換済みのSVGユーザー座標（ボードズーム考慮済み）。
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

    // 1〜設定値(laneCount) の範囲にクランプ
    const laneMax = this.plugin.settings.laneCount;
    const newLane = Math.max(LANE_MIN, Math.min(laneMax, targetLane));

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
    this.updateTabTitle();
    this.scheduleRender();
  }
}
