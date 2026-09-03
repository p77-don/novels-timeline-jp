// ============================================================
// ConfirmModal.ts
// Novels Timeline JP — 確認ダイアログ（window.confirm() の代替）
//
// 【不具合の原因】
// window.confirm()（ネイティブのブロッキングダイアログ）を Electron 上の
// Obsidian から呼び出すと、ダイアログを閉じた後に描画プロセス（レンダラー）
// 側へフォーカスが正しく戻らないことがある。
// その結果、Obsidian 上のどこをクリックしてもエディタにキャレット（カーソル）
// が表示されなくなる。OS ウィンドウを一旦切り替えて Obsidian に戻すと
// フォーカスが再計算され、症状が解消する（＝Electron 側のフォーカス管理の
// 問題であることの典型的な兆候）。
//
// 対策として、ネイティブダイアログを一切使わず、Obsidian の Modal を
// 使った確認ダイアログに置き換える。今後も確認ダイアログが必要な場合は
// window.confirm() / alert() / prompt() を使わず、必ずこの ConfirmModal
// （または同様の Modal ベースの実装）を使用すること。
// ============================================================

import { App, Modal } from "obsidian";

export interface ConfirmModalOptions {
  /** モーダル上部の見出し（省略可） */
  title?: string;
  /** 確認ボタンのラベル（既定: "OK"） */
  confirmText?: string;
  /** キャンセルボタンのラベル（既定: "キャンセル"） */
  cancelText?: string;
  /** true の場合、確認ボタンを危険操作用のスタイルにする */
  danger?: boolean;
}

export class ConfirmModal extends Modal {
  private resolved = false;

  private constructor(
    app: App,
    private message: string,
    private modalOptions: ConfirmModalOptions,
    private onResolve: (value: boolean) => void
  ) {
    super(app);
  }

  /**
   * 確認ダイアログを表示し、ユーザーの選択を Promise<boolean> で返す。
   * window.confirm() の代わりに必ずこれを使用すること。
   */
  static confirm(app: App, message: string, options: ConfirmModalOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      new ConfirmModal(app, message, options, resolve).open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ntj-confirm-modal");

    if (this.modalOptions.title) {
      contentEl.createEl("h2", { text: this.modalOptions.title });
    }

    // メッセージ中の改行ごとに段落を分けて表示する
    for (const line of this.message.split("\n")) {
      contentEl.createEl("p", { text: line });
    }

    const btnRow = contentEl.createDiv({ cls: "ntj-sf-btn-row" });

    btnRow
      .createEl("button", { cls: "ntj-sf-btn", text: this.modalOptions.cancelText ?? "キャンセル" })
      .addEventListener("click", () => {
        this.settle(false);
        this.close();
      });

    btnRow
      .createEl("button", {
        cls: this.modalOptions.danger ? "ntj-sf-btn ntj-sf-btn-danger" : "ntj-sf-btn ntj-sf-btn-primary",
        text: this.modalOptions.confirmText ?? "OK",
      })
      .addEventListener("click", () => {
        this.settle(true);
        this.close();
      });
  }

  onClose(): void {
    this.contentEl.empty();
    // Esc キーや ✕ ボタンで閉じた場合も「キャンセル」として扱う
    this.settle(false);
  }

  private settle(value: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.onResolve(value);
  }
}
