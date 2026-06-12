// ============================================================
// main.ts
// Novels Timeline JP — Obsidian プラグインエントリーポイント
// ============================================================

import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { NovelsTimelineSettings, DEFAULT_SETTINGS } from "./settings/PluginSettings";
import { TimelineView, TIMELINE_VIEW_TYPE } from "./view/TimelineView";
import { EventSidebarView, EVENT_SIDEBAR_VIEW_TYPE } from "./view/EventSidebarView";
import { NovelsTimelineSettingTab } from "./settings/SettingsTab";

export default class NovelsTimelinePlugin extends Plugin {
  settings!: NovelsTimelineSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

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
    const ribbonEl = this.addRibbonIcon("book-open", "Novels Timeline JP", () => {
      this.activateView();
    });
    // Obsidian が挿入したデフォルトアイコンをカスタムSVGで上書き
    ribbonEl.innerHTML = `<svg class="lucide lucide-timeline-icon lucide-timeline" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" version="1.1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h.01"/><path d="M4 16h.01"/><path d="M4 20h.01"/><path d="M4 4h.01"/><path d="M4 8h.01"/><g stroke-width="1.2"><path d="M9.414 13.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 12z"/><path d="M9.414 21.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 20z"/><path d="M9.414 5.414A2 2 0 0 0 10.828 6H19a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 4z"/></g></svg>`;

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
