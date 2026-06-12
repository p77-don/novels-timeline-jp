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
  ThemeMode,
} from "../types/TimelineTypes";

// ------------------------------------------------------------
// デフォルト暦（西暦互換・12か月）
// ------------------------------------------------------------

export const DEFAULT_CALENDAR: CalendarSettings = {
  name: "標準暦",
  months: [
    { month: 1,  name: "一月",   days: 31 },
    { month: 2,  name: "二月",   days: 28 },
    { month: 3,  name: "三月",   days: 31 },
    { month: 4,  name: "四月",   days: 30 },
    { month: 5,  name: "五月",   days: 31 },
    { month: 6,  name: "六月",   days: 30 },
    { month: 7,  name: "七月",   days: 31 },
    { month: 8,  name: "八月",   days: 31 },
    { month: 9,  name: "九月",   days: 30 },
    { month: 10, name: "十月",   days: 31 },
    { month: 11, name: "十一月", days: 30 },
    { month: 12, name: "十二月", days: 31 },
  ],
};

// ------------------------------------------------------------
// プラグイン設定インターフェース
// ------------------------------------------------------------

export interface NovelsTimelineSettings {
  // --- General ---
  /** 検索対象外フォルダ（Vault相対パス） */
  excludedFolders: string[];

  // --- Display ---
  /** ノード倍率（50〜300） */
  nodeScale: number;
  /** 初期ズーム率（50〜300） */
  zoomDefault: number;
  /** テーマモード */
  themeMode: ThemeMode;

  // --- Timeline ---
  /** Gap圧縮ON/OFF */
  gapCompression: boolean;
  /** Gap生成条件（日数） */
  gapThreshold: number;
  /** 起動時Gap展開 */
  autoExpandGap: boolean;

  // --- Calendar（C. 暦設定） ---
  /** 暦設定 */
  calendar: CalendarSettings;

  // --- Relation ---
  /** 関係線表示モード */
  relationDisplayMode: RelationDisplayMode;
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

  // --- Performance ---
  /** 仮想描画ON/OFF */
  virtualRendering: boolean;
  /** 先読み描画範囲（px） */
  renderBuffer: number;

  // --- Advanced ---
  /** デバッグ表示 */
  debugMode: boolean;
  /** 新規イベントノートの生成先フォルダ（空 = Vault ルート） */
  newEventFolder: string;
}

// ------------------------------------------------------------
// デフォルト設定値
// ------------------------------------------------------------

export const DEFAULT_SETTINGS: NovelsTimelineSettings = {
  excludedFolders: [],

  nodeScale: 100,
  zoomDefault: 100,
  themeMode: "auto",

  gapCompression: true,
  gapThreshold: 30,
  autoExpandGap: false,

  calendar: DEFAULT_CALENDAR,

  relationDisplayMode: "selected",
  relationStyle: "solid",
  relationWidth: 2,
  relationArrowStyle: "arrow",
  relationOpacity: 0.6,
  relationCurveStrength: 50,

  virtualRendering: true,
  renderBuffer: 1500,

  debugMode: false,
  newEventFolder: "",
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
