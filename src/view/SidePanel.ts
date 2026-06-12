// ============================================================
// SidePanel.ts
// Novels Timeline JP — 左サイドパネル
//
// 設計方針:
//   ・タイムラインビュー左端に表示する汎用スライドインパネル
//   ・「新規イベント作成」フォームを搭載
//   ・今後「イベント編集」「設定」など他用途にも流用できる構造
//   ・パネルは独立した HTMLElement として管理し、
//     表示内容は show(mode) で切り替える
// ============================================================

import { App, Notice, TFolder } from "obsidian";
import type NovelsTimelinePlugin from "../main";

// ----------------------------------------------------------
// パネルモード定義（今後追加しやすい構造）
// ----------------------------------------------------------

export type SidePanelMode =
  | { type: "create-event"; dateStr: string }
  | { type: "idle" };

// 新規イベントフォームの入力値
export interface NewEventFormData {
  date:        string;
  lane:        number;
  size:        "small" | "medium" | "big";
  color:       string;
  characters:  string;   // カンマ区切り
  locations:   string;   // カンマ区切り
  summary:     string;
  folder:      string;
}

// コールバック
export interface SidePanelCallbacks {
  onCreateEvent: (data: NewEventFormData) => Promise<void>;
}

// ----------------------------------------------------------
// SidePanel クラス
// ----------------------------------------------------------

export class SidePanel {
  private el:        HTMLElement;
  private plugin:    NovelsTimelinePlugin;
  private callbacks: SidePanelCallbacks;
  private mode:      SidePanelMode = { type: "idle" };

  constructor(
    container: HTMLElement,
    plugin: NovelsTimelinePlugin,
    callbacks: SidePanelCallbacks
  ) {
    this.plugin    = plugin;
    this.callbacks = callbacks;

    this.el = container.createDiv({ cls: "ntj-side-panel" });
    this.el.style.display = "none";
  }

  // ----------------------------------------------------------
  // 公開 API
  // ----------------------------------------------------------

  /** パネルを開いて指定モードのUIを表示する */
  open(mode: SidePanelMode): void {
    this.mode = mode;
    this.el.style.display = "flex";
    this.render();
  }

  /** パネルを閉じる */
  close(): void {
    this.mode = { type: "idle" };
    this.el.style.display = "none";
    this.el.empty();
  }

  isOpen(): boolean {
    return this.el.style.display !== "none";
  }

  // ----------------------------------------------------------
  // 描画ディスパッチャ
  // ----------------------------------------------------------

  private render(): void {
    this.el.empty();

    // 共通ヘッダー（閉じるボタン）
    const header = this.el.createDiv({ cls: "ntj-sp-header" });

    const title = header.createEl("span", { cls: "ntj-sp-title" });
    const closeBtn = header.createEl("button", {
      cls: "ntj-sp-close", text: "✕",
    });
    closeBtn.addEventListener("click", () => this.close());

    const body = this.el.createDiv({ cls: "ntj-sp-body" });

    switch (this.mode.type) {
      case "create-event":
        title.textContent = "新規イベント作成";
        this.renderCreateEventForm(body, this.mode.dateStr);
        break;
      default:
        title.textContent = "Novels Timeline JP";
        break;
    }
  }

  // ----------------------------------------------------------
  // 新規イベント作成フォーム
  // ----------------------------------------------------------

  private renderCreateEventForm(body: HTMLElement, dateStr: string): void {
    const settings = this.plugin.settings;

    // ─ date ─
    this.addField(body, "日付 *", (wrapper) => {
      const input = wrapper.createEl("input", { type: "text", cls: "ntj-sp-input" });
      input.id    = "ntj-f-date";
      input.value = dateStr;
    });

    // ─ lane ─
    this.addField(body, "レーン（-10〜10、0以外）", (wrapper) => {
      const input = wrapper.createEl("input", {
        type: "number", cls: "ntj-sp-input",
      });
      input.id    = "ntj-f-lane";
      input.value = "1";
      input.min   = "-10";
      input.max   = "10";
    });

    // ─ size ─
    this.addField(body, "サイズ", (wrapper) => {
      const sel = wrapper.createEl("select", { cls: "ntj-sp-input" });
      sel.id = "ntj-f-size";
      for (const [val, label] of [["small","小"], ["medium","中（標準）"], ["big","大"]]) {
        const opt = sel.createEl("option", { text: label });
        opt.value = val;
        if (val === "medium") opt.selected = true;
      }
    });

    // ─ color ─
    this.addField(body, "カラー", (wrapper) => {
      const row = wrapper.createDiv({ cls: "ntj-sp-color-row" });
      const picker = row.createEl("input", { type: "color", cls: "ntj-sp-color-picker" });
      picker.id    = "ntj-f-color";
      picker.value = "#808080";
      const hex = row.createEl("input", {
        type: "text", cls: "ntj-sp-input ntj-sp-color-hex",
      });
      hex.value = "#808080";
      // 同期
      picker.addEventListener("input", () => { hex.value = picker.value; });
      hex.addEventListener("input", () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) picker.value = hex.value;
      });
    });

    // ─ characters ─
    this.addField(body, "登場人物（カンマ区切り）", (wrapper) => {
      const input = wrapper.createEl("input", { type: "text", cls: "ntj-sp-input" });
      input.id          = "ntj-f-characters";
      input.placeholder = "例: アレン, ルナ";
    });

    // ─ locations ─
    this.addField(body, "場所（カンマ区切り）", (wrapper) => {
      const input = wrapper.createEl("input", { type: "text", cls: "ntj-sp-input" });
      input.id          = "ntj-f-locations";
      input.placeholder = "例: 王都, 地下室";
    });

    // ─ summary ─
    this.addField(body, "概要", (wrapper) => {
      const ta = wrapper.createEl("textarea", { cls: "ntj-sp-textarea" });
      ta.id   = "ntj-f-summary";
      ta.rows = 3;
    });

    // ─ folder ─
    this.addField(body, "保存先フォルダ", (wrapper) => {
      const input = wrapper.createEl("input", { type: "text", cls: "ntj-sp-input" });
      input.id          = "ntj-f-folder";
      input.value       = settings.newEventFolder || "";
      input.placeholder = "例: events（空でVaultルート）";
      // フォルダ候補のオートコンプリート（任意）
      const datalist = wrapper.createEl("datalist");
      datalist.id = "ntj-f-folder-list";
      input.setAttribute("list", "ntj-f-folder-list");
      this.getFolderCandidates().forEach((f) => {
        const opt = datalist.createEl("option");
        opt.value = f;
      });
    });

    // ─ ボタン群 ─
    const btnRow = body.createDiv({ cls: "ntj-sp-btn-row" });

    const submitBtn = btnRow.createEl("button", {
      cls: "ntj-sp-btn ntj-sp-btn-primary", text: "作成",
    });
    submitBtn.addEventListener("click", () => this.submitCreateEventForm());

    const cancelBtn = btnRow.createEl("button", {
      cls: "ntj-sp-btn", text: "キャンセル",
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  // ----------------------------------------------------------
  // フォーム送信
  // ----------------------------------------------------------

  private async submitCreateEventForm(): Promise<void> {
    const get = (id: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null =>
      this.el.querySelector(`#${id}`);

    const dateInput = get("ntj-f-date")     as HTMLInputElement | null;
    const laneInput = get("ntj-f-lane")     as HTMLInputElement | null;
    const sizeInput = get("ntj-f-size")     as HTMLSelectElement | null;
    const colorHex  = get("ntj-f-color")    as HTMLInputElement | null;
    const charsInput = get("ntj-f-characters") as HTMLInputElement | null;
    const locInput  = get("ntj-f-locations") as HTMLInputElement | null;
    const summaryEl = get("ntj-f-summary")  as HTMLTextAreaElement | null;
    const folderInput = get("ntj-f-folder") as HTMLInputElement | null;

    const date = dateInput?.value.trim() ?? "";
    if (!date) {
      new Notice("日付を入力してください");
      dateInput?.focus();
      return;
    }

    const laneRaw = parseInt(laneInput?.value ?? "1", 10);
    const lane    = isNaN(laneRaw) || laneRaw === 0 ? 1
                  : Math.max(-10, Math.min(10, laneRaw));

    const data: NewEventFormData = {
      date,
      lane,
      size:       (sizeInput?.value ?? "medium") as "small" | "medium" | "big",
      color:      colorHex?.value.trim() || "#808080",
      characters: charsInput?.value.trim() ?? "",
      locations:  locInput?.value.trim() ?? "",
      summary:    summaryEl?.value.trim() ?? "",
      folder:     folderInput?.value.trim() ?? "",
    };

    await this.callbacks.onCreateEvent(data);
    this.close();
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  private addField(
    parent: HTMLElement,
    labelText: string,
    buildInput: (wrapper: HTMLElement) => void
  ): void {
    const field = parent.createDiv({ cls: "ntj-sp-field" });
    field.createEl("label", { cls: "ntj-sp-label", text: labelText });
    const wrapper = field.createDiv({ cls: "ntj-sp-input-wrapper" });
    buildInput(wrapper);
  }

  /** Vault内の全フォルダパスを返す（オートコンプリート用） */
  private getFolderCandidates(): string[] {
    const folders: string[] = [];
    this.plugin.app.vault.getAllFolders().forEach((folder: TFolder) => {
      if (folder.path !== "/") folders.push(folder.path);
    });
    return folders.sort();
  }
}
