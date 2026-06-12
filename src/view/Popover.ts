// ============================================================
// Popover.ts — クリック時に表示する詳細情報
// ・ノード近傍に表示、画面外にはみ出さない
// ・ヘッダーをドラッグして移動可能
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";

export class Popover {
  private el:          HTMLElement;
  private headerEl!:   HTMLElement;
  private onLinkClick?: (eventId: string) => void;

  // ドラッグ状態
  private drag = {
    active: false,
    startMouseX: 0,
    startMouseY: 0,
    startLeft:   0,
    startTop:    0,
  };

  constructor(container: HTMLElement) {
    this.el = container.createDiv({ cls: "ntj-popover" });
    this.el.style.display  = "none";
    this.el.style.position = "fixed";
    this.el.style.zIndex   = "9998";

    // 外側クリックで閉じる（Popover自身とそのドラッグ操作は除外）
    document.addEventListener("mousedown", (e) => {
      if (!this.el.contains(e.target as Node) && !this.drag.active) {
        this.hide();
      }
    });

    document.addEventListener("mousemove", (e) => this.onMouseMove(e));
    document.addEventListener("mouseup",   ()  => this.onMouseUp());
  }

  setOnLinkClick(fn: (eventId: string) => void): void {
    this.onLinkClick = fn;
  }

  show(event: TimelineEvent, anchorX: number, anchorY: number): void {
    this.el.empty();

    // ─── ヘッダー（ドラッグハンドル） ───
    this.headerEl = this.el.createEl("div", { cls: "ntj-popover-title" });
    this.headerEl.textContent = event.displayTitle;
    this.headerEl.style.cursor = "grab";
    this.headerEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.startDrag(e);
    });

    // 閉じるボタン
    const closeBtn = this.headerEl.createEl("span", { cls: "ntj-popover-close", text: "✕" });
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); this.hide(); });

    this.el.createEl("hr", { cls: "ntj-popover-divider" });

    // ─── 内容 ───
    this.addRow("日付", event.date || "不明");

    if (event.characters.length > 0) {
      this.addSection("登場人物", event.characters);
    }
    if (event.locations.length > 0) {
      this.addSection("場所", event.locations);
    }
    if (event.summary) {
      this.addRow("概要", event.summary);
    }

    if (event.links.length > 0) {
      const section = this.el.createEl("div", { cls: "ntj-popover-section" });
      section.createEl("div", { cls: "ntj-popover-label", text: "関連イベント" });
      for (const linkId of event.links) {
        const link = section.createEl("div", { cls: "ntj-popover-link", text: linkId });
        link.addEventListener("click", (e) => {
          e.stopPropagation();
          this.onLinkClick?.(linkId);
          this.hide();
        });
      }
    }

    // 表示してサイズ取得後に位置を確定
    this.el.style.display = "block";
    this.el.style.left    = "-9999px";
    this.el.style.top     = "-9999px";

    requestAnimationFrame(() => {
      this.positionNearAnchor(anchorX, anchorY);
    });
  }

  private positionNearAnchor(anchorX: number, anchorY: number): void {
    const rect = this.el.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const GAP  = 16;

    // 右に余裕があれば右、なければ左
    let left = anchorX + GAP + rect.width < winW - 8
      ? anchorX + GAP
      : anchorX - GAP - rect.width;

    // 下方向に収まるよう調整
    let top = anchorY - 20;
    if (top + rect.height > winH - 8) top = winH - rect.height - 8;
    if (top < 8) top = 8;

    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top  = `${Math.max(8, top)}px`;
  }

  hide(): void {
    this.el.style.display = "none";
  }

  // ─── ドラッグ移動 ───

  private startDrag(e: MouseEvent): void {
    const rect = this.el.getBoundingClientRect();
    this.drag = {
      active:      true,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startLeft:   rect.left,
      startTop:    rect.top,
    };
    this.headerEl.style.cursor = "grabbing";
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.drag.active) return;
    const dx   = e.clientX - this.drag.startMouseX;
    const dy   = e.clientY - this.drag.startMouseY;
    const rect = this.el.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const newLeft = Math.max(0, Math.min(winW - rect.width,  this.drag.startLeft + dx));
    const newTop  = Math.max(0, Math.min(winH - rect.height, this.drag.startTop  + dy));

    this.el.style.left = `${newLeft}px`;
    this.el.style.top  = `${newTop}px`;
  }

  private onMouseUp(): void {
    if (!this.drag.active) return;
    this.drag.active = false;
    if (this.headerEl) this.headerEl.style.cursor = "grab";
  }

  // ─── ヘルパー ───

  private addRow(label: string, value: string): void {
    const row = this.el.createEl("div", { cls: "ntj-popover-row" });
    row.createSpan({ cls: "ntj-popover-label", text: label });
    row.createSpan({ text: value });
  }

  private addSection(label: string, items: string[]): void {
    const section = this.el.createEl("div", { cls: "ntj-popover-section" });
    section.createEl("div", { cls: "ntj-popover-label", text: label });
    for (const item of items) {
      section.createEl("div", { cls: "ntj-popover-item", text: item });
    }
  }
}
