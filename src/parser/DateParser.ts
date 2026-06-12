// ============================================================
// DateParser.ts
// Novels Timeline JP — 日付パーサー
//
// 設計方針（確認済み）:
//   A. 暦プレフィックスを無視し、年月日の数値のみで順序を算出する
//   C. CalendarSettings の月定義を使って日数を積算し timelineOrder を生成する
// ============================================================

import { CalendarSettings } from "../types/TimelineTypes";
import {
  calcYearDays,
  calcCumulativeDaysBeforeMonth,
  getMonthDef,
} from "../settings/PluginSettings";

// ------------------------------------------------------------
// 日付パース結果
// ------------------------------------------------------------

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  /** 元の文字列から抽出した暦プレフィックス（表示用）例: "帝国暦", "西暦" */
  calendarPrefix: string;
}

export interface DateParseResult {
  ok: true;
  parsed: ParsedDate;
  timelineOrder: number;
}

export interface DateParseError {
  ok: false;
  reason: string;
}

export type DateParseOutcome = DateParseResult | DateParseError;

// ------------------------------------------------------------
// 数値抽出パターン
//
// 対応フォーマット例:
//   帝国暦1345年5月12日
//   西暦2025年6月1日
//   1345年5月12日
//   1345-05-12
//   1345/05/12
//   1345.05.12
//   1345 5 12
// ------------------------------------------------------------

/** 年月日を数値として取り出す正規表現群（優先順に試行） */
const DATE_PATTERNS: RegExp[] = [
  // 「年・月・日」漢字区切り
  /(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/,
  // ハイフン区切り
  /(\d{1,6})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
  // スペース区切り
  /(\d+)\s+(\d{1,2})\s+(\d{1,2})/,
];

/** 暦プレフィックスを抽出する正規表現（数字の直前にある非数字文字列） */
const PREFIX_PATTERN = /^([^\d]*)/;

// ------------------------------------------------------------
// DateParser クラス
// ------------------------------------------------------------

export class DateParser {
  private calendar: CalendarSettings;
  private yearDays: number;

  constructor(calendar: CalendarSettings) {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }

  /**
   * 暦設定が変わったときに呼ぶ
   */
  updateCalendar(calendar: CalendarSettings): void {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }

  // ----------------------------------------------------------
  // パブリック API
  // ----------------------------------------------------------

  /**
   * date 文字列をパースし timelineOrder を返す
   *
   * @param dateStr  timelineブロックの date フィールド値
   * @returns        DateParseOutcome
   */
  parse(dateStr: string): DateParseOutcome {
    if (!dateStr || dateStr.trim() === "") {
      // 未入力 → 現在の暦の基準日（year=1, month=1, day=1 相当）
      return this.buildResult({ year: 1, month: 1, day: 1, calendarPrefix: "" });
    }

    const trimmed = dateStr.trim();

    // プレフィックス抽出（表示用のみ）
    const prefixMatch = PREFIX_PATTERN.exec(trimmed);
    const calendarPrefix = prefixMatch ? prefixMatch[1].trim() : "";

    // 年月日数値を抽出
    for (const pattern of DATE_PATTERNS) {
      const m = pattern.exec(trimmed);
      if (m) {
        const year  = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day   = parseInt(m[3], 10);

        const validationError = this.validateComponents(year, month, day);
        if (validationError) {
          return { ok: false, reason: validationError };
        }

        return this.buildResult({ year, month, day, calendarPrefix });
      }
    }

    return { ok: false, reason: `日付フォーマットを認識できません: "${dateStr}"` };
  }

  /**
   * timelineOrder から ParsedDate を逆算する（D. 座標→日付変換に使用）
   *
   * @param order  timelineOrder 値
   * @returns      ParsedDate（calendarPrefix は空文字）
   */
  orderToDate(order: number): ParsedDate {
    const yearDays = this.yearDays;
    if (yearDays === 0) {
      return { year: 1, month: 1, day: 1, calendarPrefix: "" };
    }

    // 年を求める（1始まり）
    // order = (year - 1) * yearDays + dayOfYear  という構造
    const year = Math.floor(order / yearDays) + 1;
    let remainder = order - (year - 1) * yearDays;

    // 月・日を求める
    let month = 1;
    let day = 1;
    for (const monthDef of this.calendar.months) {
      if (remainder < monthDef.days) {
        month = monthDef.month;
        day = remainder + 1; // 1始まり
        break;
      }
      remainder -= monthDef.days;
      month = monthDef.month + 1;
      day = 1;
    }

    // 月が範囲外になった場合（端数処理）
    if (month > this.calendar.months.length) {
      month = this.calendar.months.length;
      const lastMonthDef = this.calendar.months[this.calendar.months.length - 1];
      day = lastMonthDef ? lastMonthDef.days : 1;
    }

    return { year, month, day, calendarPrefix: "" };
  }

  /**
   * ParsedDate を表示用文字列に変換する
   * 月名が設定されていれば「〇月」部分を月名に置換する
   *
   * @param parsed         ParsedDate
   * @param withPrefix     プレフィックスを付けるか
   * @returns              例: "帝国暦1345年五月12日" / "1345年5月12日"
   */
  format(parsed: ParsedDate, withPrefix = true): string {
    const monthDef = getMonthDef(this.calendar, parsed.month);
    const monthLabel =
      monthDef && monthDef.name.trim() !== ""
        ? monthDef.name
        : `${parsed.month}月`;

    const prefix = withPrefix && parsed.calendarPrefix ? parsed.calendarPrefix : "";
    return `${prefix}${parsed.year}年${monthLabel}${parsed.day}日`;
  }

  /**
   * ParsedDate を「年/月/日」スラッシュ形式に変換する（UI入力・保存用）
   * 例: { year:1345, month:5, day:12 } → "1345/5/12"
   */
  formatSlash(parsed: ParsedDate): string {
    return `${parsed.year}/${parsed.month}/${parsed.day}`;
  }

  /**
   * 全角数字を半角数字に正規化する（入力補助）
   */
  static normalizeFullWidth(str: string): string {
    return str.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30)
    );
  }

  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------

  private buildResult(parsed: ParsedDate): DateParseResult {
    return {
      ok: true,
      parsed,
      timelineOrder: this.calcOrder(parsed.year, parsed.month, parsed.day),
    };
  }

  /**
   * timelineOrder の算出
   *
   *   order = (year - 1) * yearDays
   *         + cumulativeDaysBeforeMonth(month)
   *         + (day - 1)
   *
   * 例（西暦互換12か月の場合）:
   *   1345年5月12日
   *   → (1344) * 365 + (31+28+31+30) + 11
   *   → 491,568 + 120 + 11 = 491,699
   */
  private calcOrder(year: number, month: number, day: number): number {
    const yearOffset = (year - 1) * this.yearDays;
    const monthOffset = calcCumulativeDaysBeforeMonth(this.calendar, month);
    const dayOffset = day - 1;
    return yearOffset + monthOffset + dayOffset;
  }

  /**
   * 年月日の妥当性チェック
   * 月数・日数は CalendarSettings を使って検証する
   */
  private validateComponents(year: number, month: number, day: number): string | null {
    if (!Number.isInteger(year) || year < 1) {
      return `年が不正です: ${year}`;
    }

    const monthCount = this.calendar.months.length;
    if (month < 1 || month > monthCount) {
      return `月が不正です: ${month}（この暦は1〜${monthCount}月）`;
    }

    const monthDef = getMonthDef(this.calendar, month);
    if (!monthDef) {
      return `月の定義が見つかりません: ${month}月`;
    }

    if (day < 1 || day > monthDef.days) {
      return `日が不正です: ${day}（${month}月は1〜${monthDef.days}日）`;
    }

    return null;
  }
}
