// ============================================================
// TimelineParser.ts
// Novels Timeline JP — timelineブロック解析
// ============================================================

import * as yaml from "js-yaml";
import { TimelineEvent, TimelineEventError, EventSize } from "../types/TimelineTypes";
import { DateParser } from "./DateParser";
import { CalendarSettings } from "../types/TimelineTypes";

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
// ファイル名からIDとtitleを取り出す
// ------------------------------------------------------------

/**
 * "0001-旧館探索.md" → { id: "0001-旧館探索", displayTitle: "旧館探索" }
 * 番号部分（先頭の連続数字 + ハイフン）を除いた残りを displayTitle とする
 */
export function parseFileName(filePath: string): { id: string; displayTitle: string } {
  // パスからファイル名のみ取り出す
  const fileName = filePath.split("/").pop() ?? filePath;
  // .md 拡張子を除去
  const baseName = fileName.replace(/\.md$/i, "");
  // 先頭の "0001-" パターンを除去して displayTitle を生成
  const displayTitle = baseName.replace(/^\d+-/, "");
  return { id: baseName, displayTitle };
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
   * Markdown ファイル全文を受け取り、timelineブロックをパースする
   *
   * @param content   ファイル全文
   * @param filePath  Vault相対パス
   * @returns         ParseResult
   */
  parse(content: string, filePath: string): ParseResult {
    const blocks = this.extractTimelineBlocks(content);

    // Rule-001: 複数ブロック禁止
    if (blocks.length > 1) {
      return {
        ok: false,
        error: "multiple_timeline_blocks",
        message: `timelineブロックが${blocks.length}個あります（1ファイル1ブロックまで）`,
      };
    }

    // timelineブロックなし → このファイルはイベントではない
    if (blocks.length === 0) {
      return {
        ok: false,
        error: "missing_required_field",
        message: "timelineブロックが見つかりません",
      };
    }

    return this.parseBlock(blocks[0], filePath);
  }

  // ----------------------------------------------------------
  // ブロック抽出
  // ----------------------------------------------------------

  /**
   * Markdown本文から ```timeline ... ``` ブロックをすべて抽出する
   * Rule-002: timelineブロック以外は解析対象外
   */
  private extractTimelineBlocks(content: string): string[] {
    const blocks: string[] = [];
    // ````timeline も考慮（ネストされたコードブロック対応）
    const pattern = /^```+novels_timeline_jp\s*\n([\s\S]*?)^```+/gm;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      blocks.push(match[1]);
    }
    return blocks;
  }

  // ----------------------------------------------------------
  // YAMLパース
  // ----------------------------------------------------------

  private parseBlock(blockContent: string, filePath: string): ParseResult {
    const { id, displayTitle } = parseFileName(filePath);

    // YAML解析
    let raw: Record<string, unknown>;
    try {
      const parsed = yaml.load(blockContent);
      if (!parsed || typeof parsed !== "object") {
        return {
          ok: false,
          error: "missing_required_field",
          message: "timelineブロックのYAMLが空またはオブジェクトではありません",
        };
      }
      raw = parsed as Record<string, unknown>;
    } catch (e) {
      return {
        ok: false,
        error: "missing_required_field",
        message: `YAMLパースエラー: ${(e as Error).message}`,
      };
    }

    // 必須フィールド検証
    const missingFields: string[] = [];
    for (const field of ["date", "lane", "size", "color"] as const) {
      if (raw[field] === undefined || raw[field] === null || raw[field] === "") {
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

    // date パース
    const dateStr = String(raw["date"]).trim();
    const dateResult = this.dateParser.parse(dateStr);
    if (!dateResult.ok) {
      // invalid_date の場合もイベントとして生成し、error フラグを立てる
      const event = this.buildEvent({
        id, displayTitle, filePath, raw,
        date: dateStr,
        timelineOrder: 0,
        error: "invalid_date",
      });
      return { ok: true, event };
    }

    const event = this.buildEvent({
      id, displayTitle, filePath, raw,
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
    displayTitle: string;
    filePath: string;
    raw: Record<string, unknown>;
    date: string;
    timelineOrder: number;
    error?: TimelineEventError;
  }): TimelineEvent {
    const { id, displayTitle, filePath, raw, date, timelineOrder, error } = params;

    return {
      id,
      displayTitle,
      date,
      timelineOrder,
      lane: this.parseIntField(raw["lane"], 0, -10, 10),
      size: this.parseSizeField(raw["size"]),
      color: this.parseColorField(raw["color"]),
      characters: this.parseStringArray(raw["characters"]),
      locations: this.parseStringArray(raw["locations"]),
      summary: this.parseOptionalString(raw["summary"]),
      links: this.parseLinks(raw["links"]),
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

  private parseSizeField(value: unknown): EventSize {
    if (value === "small" || value === "medium" || value === "big") return value;
    return "medium";
  }

  private parseColorField(value: unknown): string {
    if (typeof value === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(value.trim())) {
      return value.trim();
    }
    return "#808080";
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
