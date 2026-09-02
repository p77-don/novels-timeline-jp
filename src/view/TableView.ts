// ============================================================
// TableView.ts
// Novels Timeline JP — テーブル表示
// ============================================================

import { TFile } from "obsidian";
import { TimelineEvent } from "../types/TimelineTypes";

export class TableView {
  private containerEl: HTMLElement;
  private tableEl!: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  /** テーブルを描画する */
  render(
    events: TimelineEvent[],
    onOpenFile: (filePath: string) => void
  ): void {
    this.containerEl.empty();

    if (events.length === 0) {
      const empty = this.containerEl.createDiv({ cls: "ntj-table-empty" });
      empty.textContent = "イベントがありません";
      return;
    }

    const wrapper = this.containerEl.createDiv({ cls: "ntj-table-wrapper" });
    const table   = wrapper.createEl("table", { cls: "ntj-table" });

    // ── ヘッダー ──
    const thead = table.createEl("thead");
    const hrow  = thead.createEl("tr");
    const headers = ["タイトル", "日付", "登場人物", "場所", "概要", "関連イベント"];
    for (const h of headers) {
      hrow.createEl("th", { text: h, cls: "ntj-th" });
    }

    // ── ボディ ──
    const tbody = table.createEl("tbody");

    for (const event of events) {
      const row = tbody.createEl("tr", { cls: "ntj-tr" });

      // タイトル（クリックでファイルを開く）
      const titleTd = row.createEl("td", { cls: "ntj-td ntj-td-title" });
      const titleLink = titleTd.createEl("span", {
        cls:  "ntj-table-link",
        text: event.displayTitle,
      });
      titleLink.addEventListener("click", () => onOpenFile(event.filePath));

      // 日付
      row.createEl("td", {
        cls:  "ntj-td ntj-td-date",
        text: event.date || "—",
      });

      // 登場人物
      const charTd = row.createEl("td", { cls: "ntj-td ntj-td-chars" });
      if (event.characters && event.characters.length > 0) {
        for (const c of event.characters) {
          charTd.createEl("span", { cls: "ntj-table-tag", text: c });
        }
      } else {
        charTd.textContent = "—";
      }

      // 場所
      const locTd = row.createEl("td", { cls: "ntj-td ntj-td-locs" });
      if (event.locations && event.locations.length > 0) {
        for (const l of event.locations) {
          locTd.createEl("span", { cls: "ntj-table-tag", text: l });
        }
      } else {
        locTd.textContent = "—";
      }

      // 概要
      row.createEl("td", {
        cls:  "ntj-td ntj-td-summary",
        text: event.summary || "—",
      });

      // 関連イベント（links）
      const linkTd = row.createEl("td", { cls: "ntj-td ntj-td-links" });
      if (event.links && event.links.length > 0) {
        for (const link of event.links) {
          // "[[0002-地下室発見]]" → "0002-地下室発見" を抽出
          const label = link.replace(/^\[\[/, "").replace(/\]\]$/, "");
          linkTd.createEl("span", { cls: "ntj-table-tag ntj-table-link-tag", text: label });
        }
      } else {
        linkTd.textContent = "—";
      }
    }

    this.tableEl = wrapper;
  }

  destroy(): void {
    this.containerEl.empty();
  }
}
