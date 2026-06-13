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
  /** ノード倍率（50〜300） */
  nodeScale: number;

  // --- Timeline ---
  /** Gap圧縮ON/OFF */
  gapCompression: boolean;
  /** Gap生成条件（日数） */
  gapThreshold: number;

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
// デフォルト設定値
// ------------------------------------------------------------

export const DEFAULT_SETTINGS: NovelsTimelineSettings = {
  newEventFolder: "",
  excludedFolders: [],

  nodeScale: 100,

  gapCompression: true,
  gapThreshold: 30,

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
