// ============================================================
// Tooltip.ts — ホバー時に表示する簡易情報
// マウス座標そのままに表示し、mousemove で追従する
//
// DOM を document.body に直接追加することで、
// 親要素の transform 等による position:fixed のズレを防ぐ
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";

export class Tooltip {
  private el: HTMLElement;

  constructor(_container: HTMLElement) {
    // body 直下に置くことで fixed 基準が確実に viewport になる
    // position / z-index / pointer-events / display は styles.css の
    // .ntj-tooltip / .ntj-tooltip.is-visible で定義する
    this.el = document.body.createDiv({ cls: "ntj-tooltip" });
  }

  show(event: TimelineEvent, nodeColor: string, mouseX: number, mouseY: number): void {
    this.el.empty();
    // イベント自身の色をアクセント帯として使い、
    // 「どのノードの情報か」を視覚的にも繋げる。
    // イベントごとに異なる動的な色のため、CSSクラス化はできずインライン指定を許容する。
    this.el.style.borderLeft = `3px solid ${nodeColor || "var(--interactive-accent)"}`;

    this.el.createEl("div", { cls: "ntj-tooltip-title", text: event.displayTitle });

    const dateRow = this.el.createEl("div", { cls: "ntj-tooltip-row" });
    dateRow.createSpan({ cls: "ntj-tooltip-icon", text: "📅" });
    dateRow.createSpan({ text: event.date || "不明" });

    if (event.characters.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-icon", text: "👤" });
      row.createSpan({ text: event.characters.length > 1
        ? `${event.characters[0]}…他` : event.characters[0] });
    }

    if (event.locations.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-icon", text: "📍" });
      row.createSpan({ text: event.locations.length > 1
        ? `${event.locations[0]}…他` : event.locations[0] });
    }

    if (event.summary) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row ntj-tooltip-summary" });
      row.createSpan({ cls: "ntj-tooltip-icon", text: "📝" });
      // _LineBreak_ を \n に戻し、white-space:pre-wrap で改行表示
      row.createSpan({
        cls: "ntj-tooltip-summary-text",
        text: event.summary.replace(/_LineBreak_/g, "\n"),
      });
    }

    // マウス追従の座標はマウス位置から都度計算する動的な値のため、
    // CSSクラス化はできずインライン指定を許容する。
    this.el.style.left = `${mouseX}px`;
    this.el.style.top  = `${mouseY}px`;
    this.el.toggleClass("is-visible", true);
  }

  move(mouseX: number, mouseY: number): void {
    if (!this.el.hasClass("is-visible")) return;
    this.el.style.left = `${mouseX}px`;
    this.el.style.top  = `${mouseY}px`;
  }

  hide(): void {
    this.el.toggleClass("is-visible", false);
  }

  /** プラグインアンロード時に DOM を片付ける */
  destroy(): void {
    this.el.remove();
  }
}
