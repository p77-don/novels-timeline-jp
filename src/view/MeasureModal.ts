// ============================================================
// MeasureModal.ts
// Novels Timeline JP — ノード間日数計測 結果表示モーダル
//
// 右クリックメニュー「ノード間日数計測」→ 始点ノード選択 →
// 終点ノード選択、の後にこのモーダルで結果を表示する。
// 編集機能は持たない（閲覧専用）。
// ============================================================

import { App, Modal } from "obsidian";

export interface MeasureResult {
  startTitle:     string;
  startDateLabel: string;
  endTitle:       string;
  endDateLabel:   string;
  /** 終点 timelineOrder - 始点 timelineOrder（負の場合は終点が過去） */
  diffDays:       number;
  /** GapEngine.formatDiff() による「年・月・日」形式のラベル */
  diffLabel:      string;
}

export class MeasureModal extends Modal {
  private result: MeasureResult;

  constructor(app: App, result: MeasureResult) {
    super(app);
    this.result = result;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ntj-measure-modal");

    contentEl.createEl("h2", { text: "ノード間日数計測" });

    const isBackward = this.result.diffDays < 0;
    const absDays    = Math.abs(this.result.diffDays);

    const table = contentEl.createDiv({ cls: "ntj-measure-table" });

    this.buildRow(table, "始点", this.result.startTitle, this.result.startDateLabel);
    this.buildRow(table, "終点", this.result.endTitle, this.result.endDateLabel);

    contentEl.createEl("hr");

    const resultEl = contentEl.createDiv({ cls: "ntj-measure-result" });
    resultEl.createDiv({ cls: "ntj-measure-days", text: `${absDays}日` });
    resultEl.createDiv({ cls: "ntj-measure-sub",  text: this.result.diffLabel });

    if (isBackward) {
      resultEl.createDiv({
        cls:  "ntj-measure-note",
        text: "※ 終点は始点より過去の日付です",
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private buildRow(parent: HTMLElement, label: string, title: string, dateLabel: string): void {
    const row = parent.createDiv({ cls: "ntj-measure-row" });
    row.createDiv({ cls: "ntj-measure-label", text: label });
    const value = row.createDiv({ cls: "ntj-measure-value" });
    value.createDiv({ cls: "ntj-measure-title", text: title });
    value.createDiv({ cls: "ntj-measure-date",  text: dateLabel });
  }
}
