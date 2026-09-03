// ============================================================
// TableView.ts
// Novels Timeline JP — テーブル表示
// ============================================================

import { TFile } from "obsidian";
import { TimelineEvent } from "../types/TimelineTypes";

export class TableView {
  private containerEl: HTMLElement;
  private tableEl!: HTMLElement;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  /**
   * @param onOpenFile     タイトルクリック時: ファイルを開く
   * @param onSelectLink   関連イベントクリック時: そのイベントの行へスクロールする
   * @param onSelectChar   登場人物クリック時: 人物フィルタへ反映する
   * @param onSelectLoc    場所クリック時: 場所フィルタへ反映する
   */
  /**
   * クリック可能な要素にキーボード操作対応（Tab移動 + Enter/Spaceで実行）を付与する。
   * マウスクリックとキーボード操作の両方で同じハンドラーを実行する。
   */
  private bindActivate(el: HTMLElement, handler: (e: Event) => void): void {
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.addEventListener("click", handler);
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      handler(e);
    });
  }

  render(
    events: TimelineEvent[],
    onOpenFile:   (filePath: string) => void,
    onSelectLink: (eventId: string) => void,
    onSelectChar: (name: string) => void,
    onSelectLoc:  (name: string) => void
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
      // 関連イベントクリック時のスクロール先特定に使用する
      row.setAttribute("data-event-id", event.id);

      // タイトル（クリックでファイルを開く）
      const titleTd = row.createEl("td", { cls: "ntj-td ntj-td-title" });
      const titleLink = titleTd.createEl("span", {
        cls:  "ntj-table-link",
        text: event.displayTitle,
      });
      titleLink.setAttribute("aria-label", `${event.displayTitle} を開く`);
      this.bindActivate(titleLink, () => onOpenFile(event.filePath));

      // 日付
      row.createEl("td", {
        cls:  "ntj-td ntj-td-date",
        text: event.date || "—",
      });

      // 登場人物（クリックで人物フィルタへ反映）
      const charTd = row.createEl("td", { cls: "ntj-td ntj-td-chars" });
      if (event.characters && event.characters.length > 0) {
        for (const c of event.characters) {
          const tag = charTd.createEl("span", { cls: "ntj-table-tag ntj-table-tag-clickable", text: c });
          this.bindActivate(tag, (e) => { e.stopPropagation(); onSelectChar(c); });
        }
      } else {
        charTd.textContent = "—";
      }

      // 場所（クリックで場所フィルタへ反映）
      const locTd = row.createEl("td", { cls: "ntj-td ntj-td-locs" });
      if (event.locations && event.locations.length > 0) {
        for (const l of event.locations) {
          const tag = locTd.createEl("span", { cls: "ntj-table-tag ntj-table-tag-clickable", text: l });
          this.bindActivate(tag, (e) => { e.stopPropagation(); onSelectLoc(l); });
        }
      } else {
        locTd.textContent = "—";
      }

      // 概要（"_LineBreak_" を改行として表示する。CSS側は white-space: pre-wrap）
      const summaryTd = row.createEl("td", { cls: "ntj-td ntj-td-summary" });
      summaryTd.textContent = event.summary
        ? event.summary.replace(/_LineBreak_/g, "\n")
        : "—";

      // 関連イベント（links。クリックでその行へスクロールする）
      const linkTd = row.createEl("td", { cls: "ntj-td ntj-td-links" });
      if (event.links && event.links.length > 0) {
        for (const link of event.links) {
          // "[[0002-地下室発見]]" → "0002-地下室発見" を抽出（旧形式との後方互換のため）
          const targetId = link.replace(/^\[\[/, "").replace(/\]\]$/, "");
          const tag = linkTd.createEl("span", { cls: "ntj-table-tag ntj-table-link-tag", text: targetId });
          this.bindActivate(tag, (e) => {
            e.stopPropagation();
            if (!this.scrollToRow(targetId)) onSelectLink(targetId);
          });
        }
      } else {
        linkTd.textContent = "—";
      }
    }

    this.tableEl = wrapper;
  }

  /**
   * 指定イベントIDの行までスクロールし、一瞬ハイライトして視認しやすくする。
   * @returns 該当行が見つかった場合は true
   */
  private scrollToRow(eventId: string): boolean {
    const target = this.containerEl.querySelector<HTMLElement>(
      `tr[data-event-id="${CSS.escape(eventId)}"]`
    );
    if (!target) return false;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    // 直前のハイライトが残っていても一旦解除してから再度付与することで、
    // 同じ行を連続でクリックした場合もアニメーションが再生されるようにする
    target.removeClass("is-highlighted");
    void target.offsetWidth; // reflow を強制してアニメーションをリスタートさせる
    target.addClass("is-highlighted");
    this.highlightTimer = setTimeout(() => {
      target.removeClass("is-highlighted");
      this.highlightTimer = null;
    }, 1600);

    return true;
  }

  destroy(): void {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.containerEl.empty();
  }
}
