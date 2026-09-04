// ============================================================
// RelatedEventModal.ts
// Novels Timeline JP — 関連イベント選択モーダル
//
// EventSidebarView（新規作成・編集フォーム）の「関連イベント登録」
// ボタンから起動する。イベント数が多いVaultでは候補が数百〜数千件に
// なり得るため、サイドバーへ直接巨大な <select> を置かず、
// モーダル内で「年・月・レーン・サイズ・配色セット・キーワード
// （タイトル／登場人物／場所／概要）による絞り込み → チェックボックス
// で複数選択 → 追加」を完結させる。
//
// サイドバー側（EventSidebarView）は「登録済みの関連イベント一覧＋
// 削除ボタン」と、このモーダルを開く「関連イベント登録」ボタンのみを
// 持つ。
// ============================================================

import { App, Modal } from "obsidian";
import { CalendarSettings, ColorPreset, EventSize } from "../types/TimelineTypes";
import { getMonthCount, getMonthDef } from "../settings/PluginSettings";
import type { EventListItem } from "./EventSidebarView";

/** モーダルへ渡す選択候補（EventSidebarView.EventListItem をそのまま使う） */
export type RelatedEventCandidate = EventListItem;

const SIZE_OPTIONS: ReadonlyArray<readonly [EventSize, string]> = [
  ["small",  "小"],
  ["medium", "中（標準）"],
  ["big",    "大"],
];

export class RelatedEventModal extends Modal {
  /** チェック済みイベントID */
  private selected = new Set<string>();

  constructor(
    app: App,
    private candidates: RelatedEventCandidate[],
    private calendar: CalendarSettings,
    /** レーン選択肢の生成に使う（サイドバー本体のレーン選択と同じ 1〜laneCount の範囲） */
    private laneCount: number,
    /** 配色セット選択肢の生成に使う */
    private colorPresets: ColorPreset[],
    /** 「追加」確定時に呼ばれる。選択された全イベントIDを渡す */
    private onAdd: (ids: string[]) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ntj-related-modal");

    contentEl.createEl("h2", { text: "関連イベントを選択" });

    if (this.candidates.length === 0) {
      contentEl.createEl("p", {
        cls:  "ntj-preset-empty",
        text: "追加できるイベントがありません（他に登録可能なイベントが存在しないか、すべて追加済みです）。",
      });
      const closeRow = contentEl.createDiv({ cls: "ntj-sf-btn-row" });
      closeRow.createEl("button", { cls: "ntj-sf-btn", text: "閉じる" })
        .addEventListener("click", () => this.close());
      return;
    }

    contentEl.createEl("p", {
      cls:  "ntj-related-modal-desc",
      text: "年・月・レーン・サイズ・配色セットやキーワード（タイトル／登場人物／場所／概要）で絞り込み、追加したいイベントにチェックを付けて「追加」を押してください（複数選択可）。",
    });

    // --------------------------------------------------------
    // 絞り込みUI（1行目：年・月・キーワード）
    // 年は候補データ中に実在する値のみ、月は暦設定の月数から生成する。
    // キーワードはタイトル・登場人物・場所・概要を対象に部分一致
    // （大小無視）で絞り込む。
    // --------------------------------------------------------
    const filterRow1 = contentEl.createDiv({ cls: "ntj-sf-link-filter-row" });

    const yearSelect   = filterRow1.createEl("select", { cls: "ntj-sf-input ntj-sf-link-filter-select" });
    const monthSelect  = filterRow1.createEl("select", { cls: "ntj-sf-input ntj-sf-link-filter-select" });
    const keywordInput = filterRow1.createEl("input",  { cls: "ntj-sf-input ntj-sf-link-filter-text" });
    keywordInput.type = "text";
    keywordInput.placeholder = "タイトル・登場人物・場所・概要で絞り込み…";

    // 年の選択肢：候補データ中に実在する年のみ（昇順・重複なし）
    const years = Array.from(
      new Set(this.candidates.map((e) => e.year).filter((y): y is number => y !== undefined))
    ).sort((a, b) => a - b);

    const yearAll = yearSelect.createEl("option", { text: "年：すべて" });
    yearAll.value = "";
    for (const y of years) {
      yearSelect.createEl("option", { text: `${y}年` }).value = String(y);
    }

    // 月の選択肢：暦設定で定義されている月数分（独自暦の月数に追従）
    const monthCount = getMonthCount(this.calendar);
    const monthAll = monthSelect.createEl("option", { text: "月：すべて" });
    monthAll.value = "";
    for (let m = 1; m <= monthCount; m++) {
      const def = getMonthDef(this.calendar, m);
      const label = def?.name ? `${m}月（${def.name}）` : `${m}月`;
      monthSelect.createEl("option", { text: label }).value = String(m);
    }

    // --------------------------------------------------------
    // 絞り込みUI（2行目：レーン・サイズ・配色セット）
    // レーンはサイドバー本体のレーン選択と同じ 1〜laneCount の範囲を
    // 選択肢化する（未使用のレーン番号も含めて一貫させる）。
    // 配色セットは ColorPresetStore に登録済みのセットのみを選択肢化する
    // （レガシーな生HEX値はどのセットにも一致しないため、選択時は対象外になる）。
    // --------------------------------------------------------
    const filterRow2 = contentEl.createDiv({ cls: "ntj-sf-link-filter-row" });

    const laneSelect  = filterRow2.createEl("select", { cls: "ntj-sf-input ntj-sf-link-filter-select" });
    const sizeSelect  = filterRow2.createEl("select", { cls: "ntj-sf-input ntj-sf-link-filter-select" });
    const colorSelect = filterRow2.createEl("select", { cls: "ntj-sf-input ntj-sf-link-filter-select" });

    const laneAll = laneSelect.createEl("option", { text: "レーン：すべて" });
    laneAll.value = "";
    for (let l = 1; l <= this.laneCount; l++) {
      laneSelect.createEl("option", { text: `レーン${l}` }).value = String(l);
    }

    const sizeAll = sizeSelect.createEl("option", { text: "サイズ：すべて" });
    sizeAll.value = "";
    for (const [v, label] of SIZE_OPTIONS) {
      sizeSelect.createEl("option", { text: label }).value = v;
    }

    const colorAll = colorSelect.createEl("option", { text: "配色：すべて" });
    colorAll.value = "";
    for (const p of this.colorPresets) {
      colorSelect.createEl("option", { text: p.name }).value = p.id;
    }

    const countEl = contentEl.createDiv({ cls: "ntj-sf-link-filter-count" });
    const listEl  = contentEl.createDiv({ cls: "ntj-related-modal-list" });

    // ボタン行（先に要素を確保し、リスト描画側から件数表示を更新できるようにする）
    const btnRow = contentEl.createDiv({ cls: "ntj-sf-btn-row" });
    const cancelBtn = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "キャンセル" });
    const addBtn    = btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-primary", text: "追加" });

    const updateAddBtn = () => {
      addBtn.setText(this.selected.size > 0 ? `追加（${this.selected.size}件）` : "追加");
      addBtn.disabled = this.selected.size === 0;
    };

    const renderList = () => {
      const yearVal  = yearSelect.value;
      const monthVal = monthSelect.value;
      const laneVal  = laneSelect.value;
      const sizeVal  = sizeSelect.value;
      const colorVal = colorSelect.value;
      const keyword  = keywordInput.value.trim().toLowerCase();

      const filtered = this.candidates.filter((e) => {
        if (yearVal  !== "" && String(e.year ?? "") !== yearVal)  return false;
        if (monthVal !== "" && String(e.month ?? "") !== monthVal) return false;
        if (laneVal  !== "" && String(e.lane) !== laneVal)         return false;
        if (sizeVal  !== "" && e.size !== sizeVal)                 return false;
        if (colorVal !== "" && e.colorId !== colorVal)             return false;

        // キーワード：タイトル・登場人物・場所・概要のいずれかに部分一致すればヒット
        if (keyword) {
          const haystack = [
            e.displayTitle,
            ...e.characters,
            ...e.locations,
            e.summary ?? "",
          ].join(" ").toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }

        return true;
      });

      listEl.empty();
      if (filtered.length === 0) {
        listEl.createEl("p", { cls: "ntj-preset-empty", text: "該当するイベントがありません。" });
      }

      // 日付（時系列）順で列挙する
      for (const e of filtered) {
        const row = listEl.createDiv({ cls: "ntj-related-modal-row" });
        const label = row.createEl("label", { cls: "ntj-related-modal-row-label" });

        const cb = label.createEl("input", { type: "checkbox", cls: "ntj-related-modal-row-cb" });
        cb.checked = this.selected.has(e.id);
        cb.addEventListener("change", () => {
          if (cb.checked) this.selected.add(e.id); else this.selected.delete(e.id);
          updateAddBtn();
        });

        label.createSpan({ cls: "ntj-related-modal-row-date",  text: e.dateLabel });
        label.createSpan({ cls: "ntj-related-modal-row-title", text: e.displayTitle });
      }

      countEl.setText(
        filtered.length === this.candidates.length
          ? `${this.candidates.length}件`
          : `${filtered.length} / ${this.candidates.length}件`
      );
    };

    yearSelect.addEventListener("change", renderList);
    monthSelect.addEventListener("change", renderList);
    laneSelect.addEventListener("change", renderList);
    sizeSelect.addEventListener("change", renderList);
    colorSelect.addEventListener("change", renderList);
    keywordInput.addEventListener("input", renderList);

    cancelBtn.addEventListener("click", () => this.close());
    addBtn.addEventListener("click", () => {
      if (this.selected.size === 0) return;
      this.onAdd(Array.from(this.selected));
      this.close();
    });

    updateAddBtn();
    renderList();
    keywordInput.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
