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
    this.el = document.body.createDiv({ cls: "ntj-tooltip" });
    this.el.style.display       = "none";
    this.el.style.position      = "fixed";
    this.el.style.zIndex        = "99999";
    this.el.style.pointerEvents = "none";
  }

  show(event: TimelineEvent, mouseX: number, mouseY: number): void {
    this.el.empty();

    this.el.createEl("div", { cls: "ntj-tooltip-title", text: event.displayTitle });

    const dateRow = this.el.createEl("div", { cls: "ntj-tooltip-row" });
    dateRow.createSpan({ cls: "ntj-tooltip-label", text: "日付" });
    dateRow.createSpan({ text: event.date || "不明" });

    if (event.characters.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-label", text: "登場人物" });
      row.createSpan({ text: event.characters.length > 1
        ? `${event.characters[0]}…他` : event.characters[0] });
    }

    if (event.locations.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-label", text: "場所" });
      row.createSpan({ text: event.locations.length > 1
        ? `${event.locations[0]}…他` : event.locations[0] });
    }

    if (event.summary) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-label", text: "概要" });
      // _LineBreak_ を \n に戻し、white-space:pre-wrap で改行表示
      const summarySpan = row.createSpan({
        text: event.summary.replace(/_LineBreak_/g, "\n")
      });
      summarySpan.style.whiteSpace = "pre-wrap";
    }

    this.el.style.left    = `${mouseX}px`;
    this.el.style.top     = `${mouseY}px`;
    this.el.style.display = "block";
  }

  move(mouseX: number, mouseY: number): void {
    if (this.el.style.display === "none") return;
    this.el.style.left = `${mouseX}px`;
    this.el.style.top  = `${mouseY}px`;
  }

  hide(): void {
    this.el.style.display = "none";
  }

  /** プラグインアンロード時に DOM を片付ける */
  destroy(): void {
    this.el.remove();
  }
}
