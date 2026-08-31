// ============================================================
// main.ts
// Novels Timeline JP — Obsidian プラグインエントリーポイント
// ============================================================

import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { NovelsTimelineSettings, DEFAULT_SETTINGS } from "./settings/PluginSettings";
import { TimelineView, TIMELINE_VIEW_TYPE } from "./view/TimelineView";
import { EventSidebarView, EVENT_SIDEBAR_VIEW_TYPE } from "./view/EventSidebarView";
import { NovelsTimelineSettingTab } from "./settings/SettingsTab";
import { ColorPresetStore } from "./store/ColorPresetStore";

export default class NovelsTimelinePlugin extends Plugin {
  settings!: NovelsTimelineSettings;
  colorPresetStore!: ColorPresetStore;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.colorPresetStore = new ColorPresetStore(this.app);
    await this.colorPresetStore.load();

    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new TimelineView(leaf, this)
    );

    this.registerView(
      EVENT_SIDEBAR_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new EventSidebarView(leaf, this)
    );

    // リボンアイコン（カスタムSVG）
    // addRibbonIcon が返す要素の innerHTML を差し替えて独自アイコンを設定する
    const ribbonEl = this.addRibbonIcon("waypoints", "Novels Timeline JP", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-novels-timeline",
      name: "タイムラインを開く",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "rebuild-novels-timeline-cache",
      name: "キャッシュを再構築",
      callback: async () => {
        const view = this.getTimelineView();
        if (view) {
          await view.rebuildAll();
          new Notice("キャッシュを再構築しました");
        }
      },
    });

    this.addSettingTab(new NovelsTimelineSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
  }

  // ----------------------------------------------------------
  // 設定
  // ----------------------------------------------------------

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 設定をディスクに保存する。
   * ビューへの反映は行わない（連鎖フリーズ防止）。
   * ビュー反映が必要な場合は notifySettingsChanged() を別途呼ぶ。
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * 設定タブからの変更完了時にビューへ反映する。
   * wheel イベント等の高頻度操作からは呼ばないこと。
   */
  notifySettingsChanged(): void {
    this.getTimelineView()?.refreshSettings();
  }

  // ----------------------------------------------------------
  // ビュー管理
  // ----------------------------------------------------------

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  getTimelineView(): TimelineView | null {
    const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (leaves.length === 0) return null;
    const view = leaves[0].view;
    return view instanceof TimelineView ? view : null;
  }

  async getOrOpenSidebarView(): Promise<EventSidebarView | null> {
    const existing = this.app.workspace.getLeavesOfType(EVENT_SIDEBAR_VIEW_TYPE);

    let leaf = existing.length > 0 ? existing[0] : null;

    if (!leaf) {
      // 右サイドバーに新規作成
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return null;
      await leaf.setViewState({ type: EVENT_SIDEBAR_VIEW_TYPE, active: true });
    }

    // 既存・新規どちらの場合も必ず展開して前面に出す
    this.app.workspace.revealLeaf(leaf);

    const view = leaf.view;
    return view instanceof EventSidebarView ? view : null;
  }
}
