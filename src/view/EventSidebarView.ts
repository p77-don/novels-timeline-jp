// ============================================================
// EventSidebarView.ts
// Novels Timeline JP — 右サイドバー（Obsidian ItemView）
// ============================================================

import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import type NovelsTimelinePlugin from "../main";
import { TimelineEvent } from "../types/TimelineTypes";
import { DateParser } from "../parser/DateParser";

export const EVENT_SIDEBAR_VIEW_TYPE = "novels-timeline-jp-sidebar";

export type SidebarMode =
  | { type: "create"; dateStr: string }
  | { type: "view-edit"; event: TimelineEvent }
  | { type: "idle" };

// ファイル名に使えない文字
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;

export class EventSidebarView extends ItemView {
  private plugin:      NovelsTimelinePlugin;
  private mode:        SidebarMode = { type: "idle" };
  private contentEl2!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: NovelsTimelinePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType():    string { return EVENT_SIDEBAR_VIEW_TYPE; }
  getDisplayText(): string { return "イベント情報"; }
  getIcon():        string { return "calendar-days"; }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("ntj-sidebar");
    this.contentEl2 = root.createDiv({ cls: "ntj-sidebar-content" });
    this.renderIdle();
  }

  async onClose(): Promise<void> { /* 特になし */ }

  // ----------------------------------------------------------
  // 公開 API
  // ----------------------------------------------------------

  showCreate(dateStr: string): void {
    this.mode = { type: "create", dateStr };
    this.refresh();
  }

  showViewEdit(event: TimelineEvent): void {
    this.mode = { type: "view-edit", event };
    this.refresh();
  }

  /** 保存・作成・削除完了後にリーフ（サイドバー）を閉じる */
  private closeLeaf(): void {
    this.mode = { type: "idle" };
    this.leaf.detach();
  }

  // ----------------------------------------------------------
  // 描画
  // ----------------------------------------------------------

  private refresh(): void {
    if (!this.contentEl2) return;
    this.contentEl2.empty();
    switch (this.mode.type) {
      case "create":    this.renderCreate(this.mode.dateStr); break;
      case "view-edit": this.renderViewEdit(this.mode.event); break;
      default:          this.renderIdle(); break;
    }
  }

  private renderIdle(): void {
    if (!this.contentEl2) return;
    this.contentEl2.createEl("p", {
      cls:  "ntj-sidebar-idle",
      text: "イベントをクリックするか、タイムライン上で右クリックして新規イベントを作成してください。",
    });
  }

  // ----------------------------------------------------------
  // 暦名ヘルパー
  // ----------------------------------------------------------

  private calendarName(): string {
    return this.plugin.settings.calendar.name?.trim() ?? "";
  }

  /** 日付フィールドのラベル（暦名付き） */
  private dateLabelText(): string {
    const cal = this.calendarName();
    return cal ? `${cal}：日付 * (yyyy/m/d)` : "日付 * (yyyy/m/d)";
  }

  /** 日付プレースホルダ */
  private datePlaceholder(): string {
    return "例: 1345/5/12";
  }

  // ----------------------------------------------------------
  // 新規イベント作成フォーム
  // ----------------------------------------------------------

  private renderCreate(dateStr: string): void {
    const el = this.contentEl2;
    el.createEl("h3", { cls: "ntj-sidebar-heading", text: "新規イベント作成" });

    // タイトル（必須）
    this.addField(el, "タイトル *", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-title"; i.placeholder = "例: 王都への出発";
    });

    // 日付（暦名付きラベル・スラッシュ形式）
    this.addField(el, this.dateLabelText(), (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-date"; i.value = dateStr; i.placeholder = this.datePlaceholder();
    });

    // レーン
    this.addField(el, "レーン（-10〜-1 または 1〜10）", (w) => {
      const i = w.createEl("input", { type: "number", cls: "ntj-sf-input" });
      i.id = "ntj-f-lane"; i.value = "1"; i.min = "-10"; i.max = "10";
    });

    // サイズ
    this.addField(el, "サイズ", (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" }); s.id = "ntj-f-size";
      for (const [v, t] of [["small","小"], ["medium","中（標準）"], ["big","大"]]) {
        const o = s.createEl("option", { text: t }); o.value = v;
        if (v === "medium") o.selected = true;
      }
    });

    // カラー
    this.addColorField(el, "ntj-f-color", "#808080");

    // 登場人物
    this.addField(el, "登場人物（カンマ区切り）", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-chars"; i.placeholder = "例: アレン, ルナ";
    });

    // 場所
    this.addField(el, "場所（カンマ区切り）", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-locs"; i.placeholder = "例: 王都, 森";
    });

    // 概要
    this.addField(el, "概要", (w) => {
      const ta = w.createEl("textarea", { cls: "ntj-sf-textarea" });
      ta.id = "ntj-f-summary"; ta.rows = 3;
    });

    // 関連イベント（選択式）
    this.addLinksField(el, "ntj-f", []);

    // 保存先フォルダ
    this.addField(el, "保存先フォルダ", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-folder";
      i.value = this.plugin.settings.newEventFolder || "";
      i.placeholder = "例: events（空でVaultルート）";
      const dl = w.createEl("datalist"); dl.id = "ntj-folder-list";
      i.setAttribute("list", "ntj-folder-list");
      this.plugin.app.vault.getAllFolders().forEach((f) => {
        if (f.path !== "/") { const o = dl.createEl("option"); o.value = f.path; }
      });
    });

    const btnRow = el.createDiv({ cls: "ntj-sf-btn-row" });
    const submit = btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-primary", text: "作成" });
    submit.addEventListener("click", () => this.submitCreate());
    const cancel = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "クリア" });
    cancel.addEventListener("click", () => { this.mode = { type: "idle" }; this.refresh(); });
  }

  // ----------------------------------------------------------
  // 既存イベント表示・編集・削除
  // ----------------------------------------------------------

  private renderViewEdit(event: TimelineEvent): void {
    const el = this.contentEl2;
    el.createEl("h3", { cls: "ntj-sidebar-heading", text: event.displayTitle });

    // タイトル
    this.addField(el, "タイトル *", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-title"; i.value = event.displayTitle;
    });

    // 日付（既存値をスラッシュ形式に変換して表示）
    this.addField(el, this.dateLabelText(), (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-date";
      i.value = this.toSlashFormat(event.date);
      i.placeholder = this.datePlaceholder();
    });

    // レーン
    this.addField(el, "レーン（-10〜-1 または 1〜10）", (w) => {
      const i = w.createEl("input", { type: "number", cls: "ntj-sf-input" });
      i.id = "ntj-e-lane"; i.value = String(event.lane); i.min = "-10"; i.max = "10";
    });

    // サイズ
    this.addField(el, "サイズ", (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" }); s.id = "ntj-e-size";
      for (const [v, t] of [["small","小"], ["medium","中"], ["big","大"]]) {
        const o = s.createEl("option", { text: t }); o.value = v;
        if (v === (event.size || "small")) o.selected = true;
      }
    });

    // カラー
    this.addColorField(el, "ntj-e-color", event.color || "#808080");

    // 登場人物
    this.addField(el, "登場人物（カンマ区切り）", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-chars"; i.value = event.characters.join(", ");
    });

    // 場所
    this.addField(el, "場所（カンマ区切り）", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-locs"; i.value = event.locations.join(", ");
    });

    // 概要（_LineBreak_を改行に戻して表示）
    this.addField(el, "概要", (w) => {
      const ta = w.createEl("textarea", { cls: "ntj-sf-textarea" });
      ta.id = "ntj-e-summary"; ta.rows = 3;
      ta.value = this.restoreSummary(event.summary ?? "");
    });

    // 関連イベント（選択式）
    this.addLinksField(el, "ntj-e", event.links);

    const btnRow = el.createDiv({ cls: "ntj-sf-btn-row" });
    btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-primary", text: "保存" })
      .addEventListener("click", () => this.submitEdit(event));
    btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-danger", text: "削除" })
      .addEventListener("click", () => this.confirmDelete(event));
    btnRow.createEl("button", { cls: "ntj-sf-btn", text: "閉じる" })
      .addEventListener("click", () => { this.mode = { type: "idle" }; this.refresh(); });
  }

  // ----------------------------------------------------------
  // 関連イベント選択UI
  // ----------------------------------------------------------

  private addLinksField(el: HTMLElement, prefix: string, currentLinks: string[]): void {
    const field = el.createDiv({ cls: "ntj-sf-field" });
    field.createEl("label", { cls: "ntj-sf-label", text: "関連イベント" });

    // 現在登録されているリンク一覧（動的に追加・削除）
    const listEl = field.createDiv({ cls: "ntj-sf-link-list" });
    listEl.id = `${prefix}-links-list`;

    // 既存リンクを描画
    for (const linkId of currentLinks) {
      this.addLinkItem(listEl, linkId);
    }

    // 追加ボタン行
    const addRow = field.createDiv({ cls: "ntj-sf-link-add-row" });
    const select = addRow.createEl("select", { cls: "ntj-sf-input ntj-sf-link-select" });
    select.id = `${prefix}-link-select`;

    // 既存イベントをselectに列挙（自分自身を除く）
    const selfId = this.mode.type === "view-edit" ? this.mode.event.id : null;
    const allEvents = this.plugin.app.vault.getMarkdownFiles()
      .map(f => f.basename)
      .filter(name => /^\d{4}-/.test(name) && name !== selfId)
      .sort();

    const placeholder = select.createEl("option", { text: "▼イベントを選択" });
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;

    for (const name of allEvents) {
      const o = select.createEl("option", { text: name }); o.value = name;
    }

    const addBtn = addRow.createEl("button", { cls: "ntj-sf-btn", text: "追加" });
    addBtn.addEventListener("click", () => {
      const val = select.value;
      if (!val) return;
      // 重複チェック
      const existing = Array.from(listEl.querySelectorAll(".ntj-sf-link-id"))
        .map(e => (e as HTMLElement).dataset.id ?? "");
      if (existing.includes(val)) {
        new Notice(`「${val}」はすでに追加されています`);
        return;
      }
      this.addLinkItem(listEl, val);
      select.value = "";
    });
  }

  private addLinkItem(listEl: HTMLElement, linkId: string): void {
    const item = listEl.createDiv({ cls: "ntj-sf-link-item" });

    // 存在チェック
    const exists = this.plugin.app.vault.getMarkdownFiles()
      .some(f => f.basename === linkId);

    const nameEl = item.createSpan({ cls: "ntj-sf-link-id", text: linkId });
    nameEl.dataset.id = linkId;
    if (!exists) {
      nameEl.addClass("ntj-sf-link-missing");
      item.createSpan({ cls: "ntj-sf-link-warn", text: " ⚠ 存在しないイベント" });
    }

    const delBtn = item.createEl("button", { cls: "ntj-sf-link-del", text: "✕" });
    delBtn.addEventListener("click", () => item.remove());
  }

  /** リンクリストから現在の選択値を取得 */
  private getLinksFromList(listId: string): string[] {
    const listEl = this.contentEl2.querySelector(`#${listId}`);
    if (!listEl) return [];
    return Array.from(listEl.querySelectorAll(".ntj-sf-link-id"))
      .map(e => (e as HTMLElement).dataset.id ?? "")
      .filter(Boolean);
  }

  // ----------------------------------------------------------
  // フォーム送信：新規作成
  // ----------------------------------------------------------

  private async submitCreate(): Promise<void> {
    const get = (id: string) =>
      this.contentEl2.querySelector(`#${id}`) as HTMLInputElement | null;

    const title     = get("ntj-f-title")?.value.trim() ?? "";
    const dateRaw   = get("ntj-f-date")?.value.trim()  ?? "";
    const laneStr   = get("ntj-f-lane")?.value.trim()  ?? "";
    const size      = (this.contentEl2.querySelector("#ntj-f-size") as HTMLSelectElement)?.value ?? "small";
    const colorVal  = get("ntj-f-color")?.value.trim() ?? "#808080";
    const chars     = get("ntj-f-chars")?.value.trim() ?? "";
    const locs      = get("ntj-f-locs")?.value.trim()  ?? "";
    const summary   = this.normalizeSummary(
      (this.contentEl2.querySelector("#ntj-f-summary") as HTMLTextAreaElement)?.value ?? "");
    const folder    = get("ntj-f-folder")?.value.trim().replace(/\/$/, "") ?? "";
    const links     = this.getLinksFromList("ntj-f-links-list");

    const errs = this.validateAll({ title, dateRaw, laneStr, colorVal });
    if (errs.length > 0) { new Notice(errs.join("\n")); return; }

    const date = DateParser.normalizeFullWidth(dateRaw);
    const lane = parseInt(laneStr, 10);
    const color = colorVal || "#808080";

    await this.createEventFile({ title, date, lane, size, color, chars, locs, summary, folder, links });
    this.closeLeaf();
  }

  // ----------------------------------------------------------
  // フォーム送信：編集保存
  // ----------------------------------------------------------

  private async submitEdit(event: TimelineEvent): Promise<void> {
    const get = (id: string) =>
      this.contentEl2.querySelector(`#${id}`) as HTMLInputElement | null;

    const title     = get("ntj-e-title")?.value.trim() ?? event.displayTitle;
    const dateRaw   = get("ntj-e-date")?.value.trim()  ?? this.toSlashFormat(event.date);
    const laneStr   = get("ntj-e-lane")?.value.trim()  ?? String(event.lane);
    const size      = (this.contentEl2.querySelector("#ntj-e-size") as HTMLSelectElement)?.value || "small";
    const colorVal  = get("ntj-e-color")?.value.trim() ?? event.color;
    const chars     = get("ntj-e-chars")?.value.trim() ?? event.characters.join(", ");
    const locs      = get("ntj-e-locs")?.value.trim()  ?? event.locations.join(", ");
    const summary   = this.normalizeSummary(
      (this.contentEl2.querySelector("#ntj-e-summary") as HTMLTextAreaElement)?.value ?? event.summary ?? "");
    const links     = this.getLinksFromList("ntj-e-links-list");

    const errs = this.validateAll({ title, dateRaw, laneStr, colorVal });
    if (errs.length > 0) { new Notice(errs.join("\n")); return; }

    const date  = DateParser.normalizeFullWidth(dateRaw);
    const lane  = parseInt(laneStr, 10);
    const color = colorVal || "#808080";

    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (!file) { new Notice("ファイルが見つかりません"); return; }

    try {
      let content = await this.plugin.app.vault.read(file);
      content = this.rewriteBlock(content, {
        date,
        lane,
        size,
        color,
        characters: chars.split(",").map(s => s.trim()).filter(Boolean),
        locations:  locs.split(",").map(s => s.trim()).filter(Boolean),
        summary,
        links,
      });

      const oldBaseName = file.basename;
      const prefix      = oldBaseName.match(/^(\d+)-/)?.[1] ?? "";
      const newBaseName = prefix ? `${prefix}-${title}` : title;
      const newFullPath = file.parent
        ? `${file.parent.path}/${newBaseName}.md`
        : `${newBaseName}.md`;

      await this.plugin.app.vault.modify(file, content);
      if (newBaseName !== oldBaseName) {
        await this.plugin.app.fileManager.renameFile(file, newFullPath);
      }

      new Notice("保存しました");
      this.closeLeaf();
    } catch (e) {
      new Notice(`保存に失敗しました: ${(e as Error).message}`);
    }
  }

  // ----------------------------------------------------------
  // バリデーション（全項目）
  // ----------------------------------------------------------

  private validateAll(params: {
    title: string;
    dateRaw: string;
    laneStr: string;
    colorVal: string;
  }): string[] {
    const errors: string[] = [];
    const { title, dateRaw, laneStr, colorVal } = params;

    // ── タイトル ──
    if (!title) {
      errors.push("タイトルを入力してください。");
    } else if (INVALID_FILENAME_CHARS.test(title)) {
      errors.push(`タイトルに使用できない記号が含まれています（\\ / : * ? " < > |）`);
    }

    // ── 日付 ──
    const normalized = DateParser.normalizeFullWidth(dateRaw);
    if (!normalized) {
      errors.push("日付を入力してください。");
    } else {
      // yyyy/m/d 形式のみ受け付ける
      const slashOnly = /^\d+\/\d+\/\d+$/.test(normalized);
      if (!slashOnly) {
        errors.push("日付は yyyy/m/d 形式で入力してください（例: 1345/5/12）。");
      } else {
        // 暦設定の範囲チェック
        const parser = new DateParser(this.plugin.settings.calendar);
        const result = parser.parse(normalized);
        if (!result.ok) {
          errors.push(`日付が暦の範囲外です: ${result.reason}`);
        }
      }
    }

    // ── レーン ──
    const lane = parseInt(laneStr, 10);
    if (isNaN(lane) || lane === 0 || lane < -10 || lane > 10) {
      errors.push("レーンは -10〜-1 または 1〜10 の整数を入力してください。");
    }

    // ── カラー ──
    if (colorVal && !/^#[0-9A-Fa-f]{6}$/.test(colorVal)) {
      errors.push("カラーは #RRGGBB 形式（例: #4A90E2）で入力してください。");
    }

    return errors;
  }

  // ----------------------------------------------------------
  // 削除確認
  // ----------------------------------------------------------

  private async confirmDelete(event: TimelineEvent): Promise<void> {
    const confirmed = confirm(
      `「${event.displayTitle}」を削除しますか？\nこの操作は取り消せません。`);
    if (!confirmed) return;
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (!file) { new Notice("ファイルが見つかりません"); return; }
    try {
      await this.plugin.app.vault.trash(file, true);
      new Notice(`削除しました: ${event.displayTitle}`);
      this.closeLeaf();
    } catch (e) {
      new Notice(`削除に失敗しました: ${(e as Error).message}`);
    }
  }

  // ----------------------------------------------------------
  // ファイル生成
  // ----------------------------------------------------------

  private async createEventFile(params: {
    title: string; date: string; lane: number;
    size: string; color: string; chars: string;
    locs: string; summary: string; folder: string;
    links: string[];
  }): Promise<void> {
    const vault    = this.plugin.app.vault;
    const maxNum   = vault.getMarkdownFiles().reduce((max, f) => {
      const n = parseInt(f.basename.split("-")[0], 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const padded   = String(maxNum + 1).padStart(4, "0");
    const fileName = `${padded}-${params.title}.md`;
    const folder   = params.folder;
    const fullPath = folder ? `${folder}/${fileName}` : fileName;

    if (folder) {
      if (!vault.getAbstractFileByPath(folder)) {
        try { await vault.createFolder(folder); } catch { /* 既存 */ }
      }
    }

    const chars = params.chars.split(",").map(s => s.trim()).filter(Boolean);
    const locs  = params.locs.split(",").map(s => s.trim()).filter(Boolean);
    const charLines = chars.length
      ? "characters:\n" + chars.map(c => `  - ${c}`).join("\n")
      : "characters:";
    const locLines = locs.length
      ? "locations:\n" + locs.map(l => `  - ${l}`).join("\n")
      : "locations:";
    const linkLines = params.links.length
      ? "links:\n" + params.links.map(l => `  - "[[${l}]]"`).join("\n")
      : "links:";

    const template = [
      `# ${padded}-${params.title}`, "",
      "```novels_timeline_jp",
      `date: ${params.date}`, "",
      `lane: ${params.lane}`, "",
      `size: ${params.size}`, "",
      `color: "${params.color}"`, "",
      charLines, "", locLines, "",
      params.summary ? `summary: ${params.summary}` : "summary:", "",
      linkLines,
      "```", "",
    ].join("\n");

    try {
      const file = await vault.create(fullPath, template);
      await this.plugin.app.workspace.getLeaf(false).openFile(file);
      new Notice(`作成しました: ${fullPath}`);
    } catch (e) {
      new Notice(`作成に失敗しました: ${(e as Error).message}`);
    }
  }

  // ----------------------------------------------------------
  // timelineブロック書き換え
  // ----------------------------------------------------------

  /**
   * ブロック本文を毎回完全に組み直す。
   * フィールド順序は仕様通り固定：
   *   1.date  2.lane  3.size  4.color
   *   5.characters  6.locations  7.summary  8.links
   * キーの有無・元の順序に関わらず常に同じレイアウトで書き出す。
   */
  private rewriteBlock(content: string, fields: {
    date: string; lane: number; size: string; color: string;
    characters: string[]; locations: string[]; summary: string | undefined;
    links: string[];
  }): string {
    return content.replace(
      /(^`{3,}novels_timeline_jp\s*$)([\s\S]*?)(^`{3,}\s*$)/m,
      (_match, open, _body, close) => {
        const lines: string[] = [];

        // 1. date
        lines.push(`date: ${fields.date}`);
        lines.push("");
        // 2. lane
        lines.push(`lane: ${fields.lane}`);
        lines.push("");
        // 3. size
        lines.push(`size: ${fields.size}`);
        lines.push("");
        // 4. color
        lines.push(`color: "${fields.color}"`);
        lines.push("");
        // 5. characters
        if (fields.characters.length > 0) {
          lines.push("characters:");
          for (const c of fields.characters) lines.push(`  - ${c}`);
        } else {
          lines.push("characters:");
        }
        lines.push("");
        // 6. locations
        if (fields.locations.length > 0) {
          lines.push("locations:");
          for (const l of fields.locations) lines.push(`  - ${l}`);
        } else {
          lines.push("locations:");
        }
        lines.push("");
        // 7. summary
        lines.push(`summary: ${fields.summary ?? ""}`);
        lines.push("");
        // 8. links
        if (fields.links.length > 0) {
          lines.push("links:");
          for (const l of fields.links) lines.push(`  - "[[${l}]]"`);
        } else {
          lines.push("links:");
        }
        lines.push("");

        return open + "\n" + lines.join("\n") + close;
      }
    );
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  /** 任意形式の日付文字列を yyyy/m/d に変換して返す */
  private toSlashFormat(dateStr: string): string {
    if (!dateStr) return "";
    const parser = new DateParser(this.plugin.settings.calendar);
    const result = parser.parse(dateStr);
    if (!result.ok) return dateStr;
    return parser.formatSlash(result.parsed);
  }

  private normalizeSummary(text: string): string {
    return text
      .replace(/\r\n/g, "_LineBreak_")
      .replace(/\r/g,   "_LineBreak_")
      .replace(/\n/g,   "_LineBreak_")
      .trim();
  }

  private restoreSummary(text: string): string {
    return text.replace(/_LineBreak_/g, "\n");
  }

  private addField(
    parent: HTMLElement,
    labelText: string,
    build: (wrapper: HTMLElement) => void
  ): void {
    const field = parent.createDiv({ cls: "ntj-sf-field" });
    field.createEl("label", { cls: "ntj-sf-label", text: labelText });
    build(field.createDiv({ cls: "ntj-sf-input-wrapper" }));
  }

  private addColorField(parent: HTMLElement, id: string, initial: string): void {
    this.addField(parent, "カラー", (w) => {
      const row    = w.createDiv({ cls: "ntj-sf-color-row" });
      const picker = row.createEl("input", { type: "color", cls: "ntj-sf-color-picker" });
      picker.value = initial;
      const hex    = row.createEl("input", { type: "text", cls: "ntj-sf-input ntj-sf-color-hex" });
      hex.id       = id;
      hex.value    = initial;
      picker.addEventListener("input", () => { hex.value = picker.value; });
      hex.addEventListener("input",   () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) picker.value = hex.value;
      });
    });
  }
}
