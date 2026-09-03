// ============================================================
// PluginSettings.ts
// Novels Timeline JP — 設定定義 & デフォルト値
// ============================================================

import {
  CalendarSettings,
  CalendarMonth,
  RelationDisplayMode,
  RelationStyle,
  RelationArrowStyle,
} from "../types/TimelineTypes";

// ------------------------------------------------------------
// デフォルト暦（西暦互換・12か月）
// 暦名: 「西暦」、月名は未設定（空文字）
// ------------------------------------------------------------

export const DEFAULT_CALENDAR: CalendarSettings = {
  name: "西暦",
  months: [
    { month: 1,  name: "",  days: 31 },
    { month: 2,  name: "",  days: 28 },
    { month: 3,  name: "",  days: 31 },
    { month: 4,  name: "",  days: 30 },
    { month: 5,  name: "",  days: 31 },
    { month: 6,  name: "",  days: 30 },
    { month: 7,  name: "",  days: 31 },
    { month: 8,  name: "",  days: 31 },
    { month: 9,  name: "",  days: 30 },
    { month: 10, name: "",  days: 31 },
    { month: 11, name: "",  days: 30 },
    { month: 12, name: "",  days: 31 },
  ],
};

// ------------------------------------------------------------
// プラグイン設定インターフェース
// ------------------------------------------------------------

export interface NovelsTimelineSettings {
  // --- General ---
  /** 新規イベントノートの生成先フォルダ（空 = Vault ルート） */
  newEventFolder: string;
  /** 検索対象外フォルダ（Vault相対パス） */
  excludedFolders: string[];

  // --- Display ---
  /** タイムラインボードの拡大率（50〜200、Shift+ホイールで変更） */
  boardZoom: number;

  // --- Timeline ---
  /** Gap圧縮ON/OFF */
  gapCompression: boolean;
  /** Gap生成条件（日数） */
  gapThreshold: number;
  /** レーン数（時間軸右側に並ぶレーン列の数。既定値10） */
  laneCount: number;

  // --- Calendar（C. 暦設定） ---
  /** 暦設定 */
  calendar: CalendarSettings;

  // --- Relation ---
  /** 関係線の色（HEXカラーコード） */
  relationColor: string;
  /** 関係線の線種 */
  relationStyle: RelationStyle;
  /** 関係線の太さ（px） */
  relationWidth: number;
  /** 矢印形状 */
  relationArrowStyle: RelationArrowStyle;
  /** 透明度（0〜1） */
  relationOpacity: number;
  /** ベジェ曲率（0〜100） */
  relationCurveStrength: number;

  // --- Advanced ---
  /** 仮想描画ON/OFF */
  virtualRendering: boolean;
  /** 先読み描画範囲（px） */
  renderBuffer: number;

  // 内部利用（UIには非表示だが他モジュールが参照）
  /** 関係線表示モード（タイムラインツールバーで変更） */
  relationDisplayMode: RelationDisplayMode;
  /** デバッグ表示 */
  debugMode: boolean;
}

// ------------------------------------------------------------
// ボードズーム（タイムラインボードの拡大率）
// Shift+ホイールで変更する。ノード単体の倍率ではなく、
// スクロール範囲全体（ボード）を拡大縮小する。
// ------------------------------------------------------------

export const BOARD_ZOOM_MIN     = 50;
export const BOARD_ZOOM_MAX     = 200;
export const BOARD_ZOOM_DEFAULT = 100;
/** Shift+ホイール1ステップあたりの変化量(%) */
export const BOARD_ZOOM_STEP    = 10;

// ------------------------------------------------------------
// Gap Threshold（Gap生成条件：日数相当値）
// ------------------------------------------------------------

export const GAP_THRESHOLD_MIN     = 3;
export const GAP_THRESHOLD_MAX     = 30;
export const GAP_THRESHOLD_DEFAULT = 30;
export const GAP_THRESHOLD_STEP    = 1;

// ------------------------------------------------------------
// Lane Count（時間軸右側に並ぶレーン列の数）
// ------------------------------------------------------------

export const LANE_COUNT_MIN     = 1;
export const LANE_COUNT_MAX     = 20;
export const LANE_COUNT_DEFAULT = 10;
export const LANE_COUNT_STEP    = 1;

// ------------------------------------------------------------
// Relation Width（関係線の太さ）/ Render Buffer（先読み描画範囲）
// sanitizeSettings() での範囲検証にも使用する
// ------------------------------------------------------------

export const RELATION_WIDTH_MIN = 1;
export const RELATION_WIDTH_MAX = 6;

export const RENDER_BUFFER_MIN = 0;
export const RENDER_BUFFER_MAX = 20000;

// ------------------------------------------------------------
// デフォルト設定値
// ------------------------------------------------------------

export const DEFAULT_SETTINGS: NovelsTimelineSettings = {
  newEventFolder: "",
  excludedFolders: [],

  boardZoom: 100,

  gapCompression: true,
  gapThreshold: GAP_THRESHOLD_DEFAULT,
  laneCount: LANE_COUNT_DEFAULT,

  calendar: DEFAULT_CALENDAR,

  relationColor: "#808080",
  relationStyle: "solid",
  relationWidth: 2,
  relationArrowStyle: "arrow",
  relationOpacity: 0.6,
  relationCurveStrength: 50,

  virtualRendering: true,
  renderBuffer: 1500,

  relationDisplayMode: "selected",
  debugMode: false,
};

// ------------------------------------------------------------
// 暦ユーティリティ
// ------------------------------------------------------------

/**
 * 暦設定から「1年の総日数」を算出する
 */
export function calcYearDays(calendar: CalendarSettings): number {
  return calendar.months.reduce((sum, m) => sum + m.days, 0);
}

/**
 * 暦設定から「月1〜指定月の前月までの累積日数」を算出する
 * 例）3月なら 1月+2月の日数の合計
 */
export function calcCumulativeDaysBeforeMonth(
  calendar: CalendarSettings,
  monthNum: number
): number {
  let days = 0;
  for (const m of calendar.months) {
    if (m.month >= monthNum) break;
    days += m.days;
  }
  return days;
}

/**
 * 暦設定から月番号に対応するCalendarMonthを取得する
 */
export function getMonthDef(
  calendar: CalendarSettings,
  monthNum: number
): CalendarMonth | undefined {
  return calendar.months.find((m) => m.month === monthNum);
}

/**
 * 暦設定の月数を返す
 */
export function getMonthCount(calendar: CalendarSettings): number {
  return calendar.months.length;
}

// ------------------------------------------------------------
// デフォルト値のディープコピー
//
// DEFAULT_SETTINGS / DEFAULT_CALENDAR は共有される単一のオブジェクトなので、
// 呼び出し元がこれらを直接代入すると、後から行った変更（暦の編集など）が
// エクスポートされた定数自体を書き換えてしまう。
// 「新しい既定値が必要な場面」では必ずこの2関数を使い、参照ではなく
// 独立したコピーを渡すこと。
// ------------------------------------------------------------

export function cloneDefaultCalendar(): CalendarSettings {
  return JSON.parse(JSON.stringify(DEFAULT_CALENDAR)) as CalendarSettings;
}

export function cloneDefaultSettings(): NovelsTimelineSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as NovelsTimelineSettings;
}

// ------------------------------------------------------------
// 検証（サニタイズ）ヘルパー
//
// loadData() から得られる値は「保存後に手編集された」「旧バージョンの形式」
// である可能性があり、TypeScriptの型は実行時のJSONデータを保証しない。
// そのため unknown として受け取り、ここで型・範囲を検証してから使う。
// ------------------------------------------------------------

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function sanitizeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_RE.test(value) ? value : fallback;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * 1か月分の定義を検証・補正する。
 * - name は文字列でなければ空文字へ
 * - days は 1以上の整数でなければ 30 へ補正
 * - month 番号は呼び出し元（sanitizeCalendar）が振り直すため、ここでは使わない
 */
function sanitizeCalendarMonth(raw: unknown, monthNumber: number): CalendarMonth {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const name = typeof obj.name === "string" ? obj.name : "";
  const daysNum = Number(obj.days);
  const days = Number.isFinite(daysNum) && daysNum >= 1 ? Math.floor(daysNum) : 30;
  return { month: monthNumber, name, days };
}

/**
 * 暦設定を検証・補正する。
 * - オブジェクトでない、または months が配列でない/空 → 既定暦（西暦12か月）へフォールバック
 * - 各月の days は 1以上の整数へ補正
 * - month 番号は 1 からの連番へ振り直す（重複・欠番・手編集による破損を解消）
 *
 * これにより、月が1つも存在しない状態（calcYearDays()が0を返し、
 * 全イベントの日付が不正扱いになる状態）を防ぐ。
 */
export function sanitizeCalendar(raw: unknown): CalendarSettings {
  if (!raw || typeof raw !== "object") {
    return cloneDefaultCalendar();
  }

  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : DEFAULT_CALENDAR.name;
  const monthsRaw = Array.isArray(obj.months) ? obj.months : [];

  const months: CalendarMonth[] = monthsRaw.map((m, i) => sanitizeCalendarMonth(m, i + 1));

  if (months.length === 0) {
    return cloneDefaultCalendar();
  }

  return { name, months };
}

/**
 * loadData() の戻り値（unknown）を検証・補正し、常に完全な
 * NovelsTimelineSettings を返す。
 *
 * 用途:
 *   - プラグイン起動時（main.ts の loadSettings()）
 *   - 設定タブでの単一項目変更後（SettingsTab の setControlValue()）
 *     ※後者は本来UI側（スライダーのmin/max等）で範囲外にならないが、
 *       将来のコントロール追加ミスや手編集データとの整合を保つための
 *       二重の安全網として適用する。
 */
export function sanitizeSettings(raw: unknown): NovelsTimelineSettings {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;

  return {
    newEventFolder: typeof obj.newEventFolder === "string" ? obj.newEventFolder : d.newEventFolder,
    excludedFolders: sanitizeStringArray(obj.excludedFolders),

    boardZoom: clampNumber(obj.boardZoom, BOARD_ZOOM_MIN, BOARD_ZOOM_MAX, d.boardZoom),

    gapCompression: typeof obj.gapCompression === "boolean" ? obj.gapCompression : d.gapCompression,
    gapThreshold: clampNumber(obj.gapThreshold, GAP_THRESHOLD_MIN, GAP_THRESHOLD_MAX, d.gapThreshold),
    laneCount: clampNumber(obj.laneCount, LANE_COUNT_MIN, LANE_COUNT_MAX, d.laneCount),

    calendar: sanitizeCalendar(obj.calendar),

    relationColor: sanitizeHexColor(obj.relationColor, d.relationColor),
    relationStyle: pickEnum(obj.relationStyle, ["solid", "dashed", "dotted"] as const, d.relationStyle),
    relationWidth: clampNumber(obj.relationWidth, RELATION_WIDTH_MIN, RELATION_WIDTH_MAX, d.relationWidth),
    relationArrowStyle: pickEnum(obj.relationArrowStyle, ["none", "arrow", "triangle"] as const, d.relationArrowStyle),
    relationOpacity: clampNumber(obj.relationOpacity, 0, 1, d.relationOpacity),
    relationCurveStrength: clampNumber(obj.relationCurveStrength, 0, 100, d.relationCurveStrength),

    virtualRendering: typeof obj.virtualRendering === "boolean" ? obj.virtualRendering : d.virtualRendering,
    renderBuffer: clampNumber(obj.renderBuffer, RENDER_BUFFER_MIN, RENDER_BUFFER_MAX, d.renderBuffer),

    relationDisplayMode: pickEnum(obj.relationDisplayMode, ["selected", "always", "hidden"] as const, d.relationDisplayMode),
    debugMode: typeof obj.debugMode === "boolean" ? obj.debugMode : d.debugMode,
  };
}
