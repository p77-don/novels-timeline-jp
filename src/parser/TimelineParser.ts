// ============================================================
// TimelineParser.ts
// Novels Timeline JP — フロントマター（NTJP_* キー）解析
// ============================================================
//
// v2.0 でデータの保存先をコードブロックからフロントマターへ移行した。
// フロントマターは Obsidian の metadataCache が既にパース済みのため、
// このクラスは YAML の生パースは行わず、渡された frontmatter オブジェクト
// （app.metadataCache.getFileCache(file)?.frontmatter）を解釈するのみ。
// ============================================================

import { TimelineEvent, TimelineEventError, EventSize } from "../types/TimelineTypes";
import { DateParser } from "./DateParser";
import { CalendarSettings } from "../types/TimelineTypes";

// ------------------------------------------------------------
// フロントマターキー名（一元管理）
// ------------------------------------------------------------

export const NTJP_KEYS = {
  eventNumber: "NTJP_event_number",
  eventTitle:  "NTJP_event_title",
  date:        "NTJP_date",
  lane:        "NTJP_lane",
  node:        "NTJP_node",
  colors:      "NTJP_colors",
  characters:  "NTJP_characters",
  locations:   "NTJP_locations",
  links:       "NTJP_links",
  summary:     "NTJP_summary",
} as const;

// ------------------------------------------------------------
// パース結果
// ------------------------------------------------------------

export interface ParseSuccess {
  ok: true;
  event: TimelineEvent;
}

export interface ParseFailure {
  ok: false;
  error: TimelineEventError;
  message: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

// ------------------------------------------------------------
// Wikilink 抽出ユーティリティ
// ------------------------------------------------------------

/** [[0001-旧館探索]] → "0001-旧館探索" */
function extractWikilinkTarget(raw: string): string {
  const m = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/.exec(raw.trim());
  return m ? m[1].trim() : raw.trim();
}

// ------------------------------------------------------------
// ファイル名からIDを取り出す
// ------------------------------------------------------------

/**
 * "0001-旧館探索.md" → { id: "0001-旧館探索", legacyDisplayTitle: "旧館探索" }
 * legacyDisplayTitle は NTJP_event_title 未設定の古いノート向けフォールバック用。
 */
export function parseFileName(filePath: string): { id: string; legacyDisplayTitle: string } {
  const fileName = filePath.split("/").pop() ?? filePath;
  const baseName = fileName.replace(/\.md$/i, "");
  const legacyDisplayTitle = baseName.replace(/^\d+-/, "");
  return { id: baseName, legacyDisplayTitle };
}

// ------------------------------------------------------------
// TimelineParser クラス
// ------------------------------------------------------------

export class TimelineParser {
  private dateParser: DateParser;

  constructor(calendar: CalendarSettings) {
    this.dateParser = new DateParser(calendar);
  }

  updateCalendar(calendar: CalendarSettings): void {
    this.dateParser.updateCalendar(calendar);
  }

  // ----------------------------------------------------------
  // メインエントリ
  // ----------------------------------------------------------

  /**
   * フロントマターオブジェクトを受け取り、TimelineEvent を構築する。
   * 呼び出し側（DiscoveryEngine）は、あらかじめ NTJP_date キーの有無で
   * 「このファイルはイベントか」を判定してから呼び出すこと。
   *
   * @param frontmatter  app.metadataCache.getFileCache(file)?.frontmatter
   * @param filePath     Vault相対パス
   */
  parse(frontmatter: Record<string, unknown> | undefined, filePath: string): ParseResult {
    if (!frontmatter || typeof frontmatter !== "object") {
      return {
        ok: false,
        error: "missing_required_field",
        message: "フロントマターが見つかりません",
      };
    }

    // 必須フィールド検証
    const missingFields: string[] = [];
    for (const field of [NTJP_KEYS.date, NTJP_KEYS.lane, NTJP_KEYS.node, NTJP_KEYS.colors]) {
      const v = frontmatter[field];
      if (v === undefined || v === null || v === "") {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      return {
        ok: false,
        error: "missing_required_field",
        message: `必須フィールドが不足しています: ${missingFields.join(", ")}`,
      };
    }

    const { id, legacyDisplayTitle } = parseFileName(filePath);

    // date パース
    const dateStr = String(frontmatter[NTJP_KEYS.date]).trim();
    const dateResult = this.dateParser.parse(dateStr);

    if (!dateResult.ok) {
      // invalid_date の場合もイベントとして生成し、error フラグを立てる
      const event = this.buildEvent({
        id, legacyDisplayTitle, filePath, frontmatter,
        date: dateStr,
        timelineOrder: 0,
        error: "invalid_date",
      });
      return { ok: true, event };
    }

    const event = this.buildEvent({
      id, legacyDisplayTitle, filePath, frontmatter,
      date: dateStr,
      timelineOrder: dateResult.timelineOrder,
      error: undefined,
    });

    return { ok: true, event };
  }

  // ----------------------------------------------------------
  // イベントオブジェクト構築
  // ----------------------------------------------------------

  private buildEvent(params: {
    id: string;
    legacyDisplayTitle: string;
    filePath: string;
    frontmatter: Record<string, unknown>;
    date: string;
    timelineOrder: number;
    error?: TimelineEventError;
  }): TimelineEvent {
    const { id, legacyDisplayTitle, filePath, frontmatter, date, timelineOrder, error } = params;

    return {
      id,
      eventNumber:  this.parseIntField(frontmatter[NTJP_KEYS.eventNumber], 0, 0, 9999),
      displayTitle: this.parseTitleField(frontmatter[NTJP_KEYS.eventTitle], legacyDisplayTitle),
      date,
      timelineOrder,
      lane: this.parseIntField(frontmatter[NTJP_KEYS.lane], 1, 1, 10),
      size: this.parseSizeField(frontmatter[NTJP_KEYS.node]),
      color: this.parseColorField(frontmatter[NTJP_KEYS.colors]),
      characters: this.parseStringArray(frontmatter[NTJP_KEYS.characters]),
      locations: this.parseStringArray(frontmatter[NTJP_KEYS.locations]),
      summary: this.parseOptionalString(frontmatter[NTJP_KEYS.summary]),
      links: this.parseLinks(frontmatter[NTJP_KEYS.links]),
      filePath,
      error,
    };
  }

  // ----------------------------------------------------------
  // フィールドパースヘルパー
  // ----------------------------------------------------------

  private parseIntField(value: unknown, defaultVal: number, min: number, max: number): number {
    if (value === undefined || value === null) return defaultVal;
    const n = Number(value);
    if (!Number.isFinite(n)) return defaultVal;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  /**
   * NTJP_event_title を優先し、未設定・空の場合のみ
   * ファイル名から番号部分を除いた文字列にフォールバックする
   * （NTJP_event_title 導入前の古いノートとの後方互換）。
   */
  private parseTitleField(value: unknown, legacyDisplayTitle: string): string {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return legacyDisplayTitle;
  }

  private parseSizeField(value: unknown): EventSize {
    if (value === "small" || value === "medium" || value === "big") return value;
    return "medium";
  }

  /**
   * NTJP_colors フィールドを解釈する。
   * 通常は配色セットのID（例: "preset-1735500000-1234"）を保持するが、
   * 配色セット導入前の古いノートに残る生のHEXコード（例: "#4A90E2"）も
   * そのまま許容する（実色解決は ColorPresetStore.resolve() が行う）。
   * 空・不正な値の場合のみ既定値にフォールバックする。
   */
  private parseColorField(value: unknown, defaultVal: string = "#808080"): string {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return defaultVal;
  }

  private parseStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .filter((v) => v !== null && v !== undefined)
        .map((v) => String(v).trim())
        .filter((v) => v !== "");
    }
    if (typeof value === "string" && value.trim() !== "") {
      return [value.trim()];
    }
    return [];
  }

  private parseOptionalString(value: unknown): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    return String(value).trim() || undefined;
  }

  private parseLinks(value: unknown): string[] {
    const raw = this.parseStringArray(value);
    return raw.map(extractWikilinkTarget).filter((v) => v !== "");
  }
}
