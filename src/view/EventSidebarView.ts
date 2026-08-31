// ============================================================
// EventSidebarView.ts
// Novels Timeline JP — 右サイドバー（Obsidian ItemView）
// ============================================================
//
// v2.0: イベントデータの保存先をコードブロックからフロントマター
// （NTJP_* キー）へ移行。編集の書き込みは Obsidian 標準の
// app.fileManager.processFrontMatter() を使用し、他プラグイン・他用途の
// フロントマターキーを壊さないようにする。
// ============================================================

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type NovelsTimelinePlugin from "../main";
import { TimelineEvent, ColorPreset } from "../types/TimelineTypes";
import { DateParser } from "../parser/DateParser";
import { NTJP_KEYS } from "../parser/TimelineParser";
import { ColorPresetModal } from "./ColorPresetModal";

export const EVENT_SIDEBAR_VIEW_TYPE = "novels-timeline-jp-sidebar";

export type SidebarMode =
  | { type: "create"; dateStr: string; lane: number }
  | { type: "view-edit"; event: TimelineEvent }
  | { type: "idle" };

// ファイル名に使えない文字
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;

/** 関連イベント選択リストで使う軽量な一覧アイテム */
interface EventListItem {
  id: string;
  eventNumber: number;
  displayTitle: string;
}

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

  showCreate(dateStr: string, lane: number): void {
    this.mode = { type: "create", dateStr, lane };
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
      case "create":    this.renderCreate(this.mode.dateStr, this.mode.lane); break;
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

  private renderCreate(dateStr: string, lane: number): void {
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

    // レーン（右クリック位置から自動取得、手動修正も可）
    this.addField(el, "レーン（1〜10）", (w) => {
      const i = w.createEl("input", { type: "number", cls: "ntj-sf-input" });
      const clampedLane = Math.max(1, Math.min(10, Math.round(lane)));
      i.id = "ntj-f-lane"; i.value = String(clampedLane); i.min = "1"; i.max = "10";
    });

    // サイズ（ノードタイプ）
    this.addField(el, "サイズ", (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" }); s.id = "ntj-f-size";
      for (const [v, t] of [["small","小"], ["medium","中（標準）"], ["big","大"]]) {
        const o = s.createEl("option", { text: t }); o.value = v;
        if (v === "medium") o.selected = true;
      }
    });

    // 配色セット（新規作成時は最初のセットを既定値に。無ければグレーのカスタム値）
    {
      const presets = this.plugin.colorPresetStore.getAll();
      const defaultColor = presets.length > 0 ? presets[0].id : "#808080";
      this.addColorPresetField(el, "ntj-f", defaultColor);
    }

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

    // イベント番号（自動付与・読み取り専用表示）
    el.createEl("p", {
      cls: "ntj-sidebar-eventnumber",
      text: `イベント番号: ${String(event.eventNumber).padStart(4, "0")}`,
    });

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
    this.addField(el, "レーン（1〜10）", (w) => {
      const i = w.createEl("input", { type: "number", cls: "ntj-sf-input" });
      i.id = "ntj-e-lane"; i.value = String(event.lane); i.min = "1"; i.max = "10";
    });

    // サイズ（ノードタイプ）
    this.addField(el, "サイズ", (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" }); s.id = "ntj-e-size";
      for (const [v, t] of [["small","小"], ["medium","中"], ["big","大"]]) {
        const o = s.createEl("option", { text: t }); o.value = v;
        if (v === (event.size || "small")) o.selected = true;
      }
    });

    // 配色セット
    this.addColorPresetField(el, "ntj-e", event.color || "#808080");

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
  // Vault横断でイベント一覧を取得するヘルパー
  // ----------------------------------------------------------
  //
  // TimelineView（タイムライン画面）が開いていなくてもサイドバー単体で
  // 正しく動作するよう、TimelineView の EventStore には依存せず、
  // vault + metadataCache から直接フロントマターを読み取る。
  // NTJP_date の有無で「イベントファイルかどうか」を判定する
  // （DiscoveryEngine の判定条件と揃えている）。

  private listAllEvents(): EventListItem[] {
    const { vault, metadataCache } = this.plugin.app;
    const items: EventListItem[] = [];

    for (const file of vault.getMarkdownFiles()) {
      const fm = metadataCache.getFileCache(file)?.frontmatter;
      if (!fm || fm[NTJP_KEYS.date] === undefined) continue;

      const eventNumber = Number(fm[NTJP_KEYS.eventNumber]);
      const rawTitle = fm[NTJP_KEYS.eventTitle];
      const displayTitle =
        typeof rawTitle === "string" && rawTitle.trim().length > 0
          ? rawTitle.trim()
          : file.basename.replace(/^\d+-/, "");

      items.push({
        id: file.basename,
        eventNumber: Number.isFinite(eventNumber) ? eventNumber : 0,
        displayTitle,
      });
    }

    return items;
  }

  /** 既存イベントの中で最大の NTJP_event_number を返す（無ければ 0） */
  private getMaxEventNumber(): number {
    return this.listAllEvents().reduce((max, e) => Math.max(max, e.eventNumber), 0);
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

    // 既存イベント一覧（自分自身を除く・NTJP_event_number順）を先に取得
    const selfId = this.mode.type === "view-edit" ? this.mode.event.id : null;
    const allEvents = this.listAllEvents()
      .filter((e) => e.id !== selfId)
      .sort((a, b) => a.eventNumber - b.eventNumber);
    const eventById = new Map(allEvents.map((e) => [e.id, e]));

    // 既存リンクを描画
    for (const linkId of currentLinks) {
      this.addLinkItem(listEl, linkId, eventById);
    }

    // 追加ボタン行
    const addRow = field.createDiv({ cls: "ntj-sf-link-add-row" });
    const select = addRow.createEl("select", { cls: "ntj-sf-input ntj-sf-link-select" });
    select.id = `${prefix}-link-select`;

    const placeholder = select.createEl("option", { text: "▼イベントを選択" });
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;

    // NTJP_event_number 順で列挙する
    for (const e of allEvents) {
      const label = `${String(e.eventNumber).padStart(4, "0")}: ${e.displayTitle}`;
      const o = select.createEl("option", { text: label });
      o.value = e.id;
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
      this.addLinkItem(listEl, val, eventById);
      select.value = "";
    });
  }

  private addLinkItem(listEl: HTMLElement, linkId: string, eventById: Map<string, EventListItem>): void {
    const item = listEl.createDiv({ cls: "ntj-sf-link-item" });

    const matched = eventById.get(linkId);
    const displayText = matched
      ? `${String(matched.eventNumber).padStart(4, "0")}: ${matched.displayTitle}`
      : linkId;

    const nameEl = item.createSpan({ cls: "ntj-sf-link-id", text: displayText });
    nameEl.dataset.id = linkId;
    if (!matched) {
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
      const charList = chars.split(",").map(s => s.trim()).filter(Boolean);
      const locList  = locs.split(",").map(s => s.trim()).filter(Boolean);

      // フロントマターの書き換えは Obsidian 標準の processFrontMatter を使う。
      // これにより NTJP_* 以外の既存フロントマターキー（他プラグイン等）を
      // 壊さずに済み、また Wikilink 文字列の引用符付けも Obsidian 側の
      // シリアライザに任せられる。
      await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
        fm[NTJP_KEYS.eventTitle] = title;
        fm[NTJP_KEYS.date]       = date;
        fm[NTJP_KEYS.lane]       = lane;
        fm[NTJP_KEYS.node]       = size;
        fm[NTJP_KEYS.colors]     = color;
        fm[NTJP_KEYS.characters] = charList;
        fm[NTJP_KEYS.locations]  = locList;
        fm[NTJP_KEYS.summary]    = summary || undefined;
        fm[NTJP_KEYS.links]      = links.map((l) => `[[${l}]]`);
        // NTJP_event_number は自動付与のため、ここでは触れない（既存値を保持）
      });

      // タイトル変更時はファイル名も追従させる（番号プレフィックスは維持）
      const oldBaseName = file.basename;
      const prefix      = oldBaseName.match(/^(\d+)-/)?.[1] ?? "";
      const newBaseName = prefix ? `${prefix}-${title}` : title;
      const newFullPath = file.parent
        ? `${file.parent.path}/${newBaseName}.md`
        : `${newBaseName}.md`;

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
    if (isNaN(lane) || lane < 1 || lane > 10) {
      errors.push("レーンは 1〜10 の整数を入力してください。");
    }

    // ── カラー（配色セットID、またはレガシーな生HEX値） ──
    if (!colorVal) {
      errors.push("配色セットを選択してください。");
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
    const vault = this.plugin.app.vault;

    // イベント番号は、既存イベントの NTJP_event_number の最大値+1 を自動採番する
    // （フロントマターを走査。ファイル名の数字プレフィックスには依存しない）
    const nextNumber = this.getMaxEventNumber() + 1;
    const padded     = String(nextNumber).padStart(4, "0");
    const fileName   = `${padded}-${params.title}.md`;
    const folder     = params.folder;
    const fullPath   = folder ? `${folder}/${fileName}` : fileName;

    if (folder) {
      if (!vault.getAbstractFileByPath(folder)) {
        try { await vault.createFolder(folder); } catch { /* 既存 */ }
      }
    }

    const chars = params.chars.split(",").map(s => s.trim()).filter(Boolean);
    const locs  = params.locs.split(",").map(s => s.trim()).filter(Boolean);

    const frontmatter = this.buildFrontmatterText({
      eventNumber: nextNumber,
      title: params.title,
      date: params.date,
      lane: params.lane,
      size: params.size,
      color: params.color,
      characters: chars,
      locations: locs,
      summary: params.summary,
      links: params.links,
    });

    const content = `${frontmatter}\n# ${params.title}\n`;

    try {
      await vault.create(fullPath, content);
      // 作成のたびにノートが開くと煩わしいため、ここでは開かない。
      new Notice(`作成しました: ${fullPath}`);
    } catch (e) {
      new Notice(`作成に失敗しました: ${(e as Error).message}`);
    }
  }

  // ----------------------------------------------------------
  // フロントマター生成（新規作成専用）
  // ----------------------------------------------------------
  //
  // 新規ファイルにはまだ他プラグインのフロントマターキーが存在しないため、
  // processFrontMatter を使わずテキストを直接組み立てる。
  // Wikilink は YAML 上で quote しないと "[[" がフロー配列として
  // 誤解釈されるため、明示的にダブルクォートで囲む。

  private buildFrontmatterText(fields: {
    eventNumber: number;
    title: string;
    date: string;
    lane: number;
    size: string;
    color: string;
    characters: string[];
    locations: string[];
    summary: string;
    links: string[];
  }): string {
    const lines: string[] = ["---"];

    lines.push(`${NTJP_KEYS.eventNumber}: ${fields.eventNumber}`);
    lines.push(`${NTJP_KEYS.eventTitle}: "${this.escapeYamlDouble(fields.title)}"`);
    lines.push(`${NTJP_KEYS.date}: ${fields.date}`);
    lines.push(`${NTJP_KEYS.lane}: ${fields.lane}`);
    lines.push(`${NTJP_KEYS.node}: ${fields.size}`);
    lines.push(`${NTJP_KEYS.colors}: "${fields.color}"`);

    if (fields.characters.length > 0) {
      lines.push(`${NTJP_KEYS.characters}:`);
      for (const c of fields.characters) lines.push(`  - ${c}`);
    } else {
      lines.push(`${NTJP_KEYS.characters}: []`);
    }

    if (fields.locations.length > 0) {
      lines.push(`${NTJP_KEYS.locations}:`);
      for (const l of fields.locations) lines.push(`  - ${l}`);
    } else {
      lines.push(`${NTJP_KEYS.locations}: []`);
    }

    lines.push(`${NTJP_KEYS.summary}: "${this.escapeYamlDouble(fields.summary)}"`);

    if (fields.links.length > 0) {
      lines.push(`${NTJP_KEYS.links}:`);
      for (const l of fields.links) lines.push(`  - "[[${l}]]"`);
    } else {
      lines.push(`${NTJP_KEYS.links}: []`);
    }

    lines.push("---", "");
    return lines.join("\n");
  }

  private escapeYamlDouble(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

  /**
   * 配色セットから選択するフィールド。
   * 選択結果は隠しinput（id: `${idPrefix}-color`）に「配色セットのID」として
   * 書き込まれる（実色ではない）。submitCreate/submitEdit はこのIDをそのまま
   * イベントノートの NTJP_colors フィールドへ保存する。
   * こうすることで、配色セット側の色を変更すれば、それを参照する
   * 全イベントの表示色を一括で変更できる。
   *
   * currentColorValue は既存イベントの NTJP_colors フィールドの現在値
   * （配色セットIDまたは配色セット導入前の生HEX値）。
   * どの配色セットにも一致しない場合は、データを勝手に書き換えないよう
   * 「カスタム（現在の色）」を選択肢に加え、その値をそのまま保持する。
   */
  private addColorPresetField(
    parent: HTMLElement,
    idPrefix: string,
    currentColorValue: string
  ): void {
    const store = this.plugin.colorPresetStore;

    this.addField(parent, "配色セット", (w) => {
      const row = w.createDiv({ cls: "ntj-sf-color-row" });

      const select = row.createEl("select", { cls: "ntj-sf-input" });

      const previewWrap = row.createDiv({ cls: "ntj-sf-color-preview" });
      const previewSwatch = previewWrap.createDiv({ cls: "ntj-sf-color-preview-swatch" });
      previewSwatch.setText("12");

      const colorInput = row.createEl("input", { type: "hidden" });
      colorInput.id = `${idPrefix}-color`;

      const applySelection = (): void => {
        colorInput.value = select.value === "__custom__" ? currentColorValue : select.value;
        const colors = store.resolve(colorInput.value);
        previewSwatch.style.backgroundColor = colors.nodeColor;
        previewSwatch.style.color           = colors.textColor;
      };

      const populate = (): void => {
        select.empty();
        const presets: ColorPreset[] = store.getAll();
        const matched = store.getById(currentColorValue);

        if (!matched) {
          const customOpt = select.createEl("option", { text: "カスタム（現在の色）" });
          customOpt.value = "__custom__";
        }

        for (const p of presets) {
          const opt = select.createEl("option", { text: p.name });
          opt.value = p.id;
        }

        select.value = matched ? matched.id : "__custom__";
        applySelection();
      };

      select.addEventListener("change", applySelection);

      const editBtn = row.createEl("button", {
        type: "button", cls: "ntj-sf-btn", text: "編集...",
      });
      editBtn.addEventListener("click", () => {
        new ColorPresetModal(this.plugin.app, store, () => populate()).open();
      });

      populate();
    });
  }
}
