// ============================================================
// TimelineTypes.ts
// Novels Timeline JP — 型定義
// ============================================================

export type EventSize = "small" | "medium" | "big";

export type RelationDisplayMode = "selected" | "always" | "hidden";

export type RelationStyle = "solid" | "dashed" | "dotted";

export type RelationArrowStyle = "none" | "arrow" | "triangle";

export type ThemeMode = "auto" | "light" | "dark";

// ------------------------------------------------------------
// 暦設定（C. の仕様追加対応）
// ------------------------------------------------------------

/** 1か月の定義 */
export interface CalendarMonth {
  /** 月番号（1始まり） */
  month: number;
  /** 月名（未設定なら空文字）*/
  name: string;
  /** この月の日数 */
  days: number;
}

/**
 * 暦設定
 * 例）西暦 = 12か月、それぞれ31/28/31/30...日
 * 例）独自暦 = 4か月、それぞれ90日
 */
export interface CalendarSettings {
  /** 暦の名前（表示用、任意） */
  name: string;
  /** 月の定義リスト（月番号昇順） */
  months: CalendarMonth[];
}

// ------------------------------------------------------------
// イベント
// ------------------------------------------------------------

export interface TimelineEvent {
  /** イベントID = ファイル名（拡張子なし）例: "0001-旧館探索" */
  id: string;

  /** 表示タイトル = ファイル名から番号部分を除いたもの 例: "旧館探索" */
  displayTitle: string;

  /** date フィールドの生文字列 例: "帝国暦1345年5月12日" */
  date: string;

  /**
   * 描画用内部時系列値
   * date から DateParser が生成。Markdown には保存しない。
   * 算出式: 年 * (1年の総日数) + 月までの累積日数 + 日
   */
  timelineOrder: number;

  /** 時間軸からの相対配置番号（-10〜+10、0は時間軸） */
  lane: number;

  /** ノードサイズ */
  size: EventSize;

  /** カラーコード（HEX） */
  color: string;

  /** 登場人物一覧 */
  characters: string[];

  /** 場所一覧 */
  locations: string[];

  /** イベント概要 */
  summary?: string;

  /** リンク先イベントID一覧（Wikilinkから抽出） */
  links: string[];

  /** Vaultルートからの相対ファイルパス */
  filePath: string;

  /** パースエラー種別（正常時は undefined） */
  error?: TimelineEventError;
}

export type TimelineEventError =
  | "invalid_date"
  | "missing_required_field"
  | "multiple_timeline_blocks";

// ------------------------------------------------------------
// キャッシュ
// ------------------------------------------------------------

export interface CacheEntry {
  /** timelineOrder */
  order: number;
  /** date 文字列（再生成判定用） */
  date: string;
}

export interface TimelineCache {
  /** キャッシュ生成時のタイムスタンプ */
  generatedAt: number;
  /** イベントID → CacheEntry */
  entries: Record<string, CacheEntry>;
}

// ------------------------------------------------------------
// レイアウト
// ------------------------------------------------------------

/** 描画座標付きイベント */
export interface LayoutNode {
  event: TimelineEvent;
  /** SVG上のX座標 */
  x: number;
  /** SVG上のY座標（timelineOrderに基づく） */
  y: number;
  /** ノードの実描画半径（size × スケール） */
  radius: number;
}

/** Gap（時間圧縮表示）*/
export interface GapSegment {
  /** Gap直前のイベントのtimelineOrder */
  fromOrder: number;
  /** Gap直後のイベントのtimelineOrder */
  toOrder: number;
  /** SVG上のY座標（Gap表示位置） */
  y: number;
  /** 差分の表示文字列 例: "3年", "2か月", "5日" */
  label: string;
  /** 展開中かどうか */
  expanded: boolean;
}

// ------------------------------------------------------------
// 関係線
// ------------------------------------------------------------

export interface RelationEdge {
  fromId: string;
  toId: string;
  fromNode: LayoutNode;
  toNode: LayoutNode;
}

// ------------------------------------------------------------
// フィルタ状態
// ------------------------------------------------------------

export interface FilterState {
  /** 選択中の登場人物（空 = フィルタなし） */
  characters: Set<string>;
  /** 選択中の場所（空 = フィルタなし） */
  locations: Set<string>;
  /** 検索キーワード */
  searchQuery: string;
}

// ------------------------------------------------------------
// 仮想描画ウィンドウ
// ------------------------------------------------------------

export interface VirtualWindow {
  /** スクロール上端Y */
  scrollTop: number;
  /** スクロール左端X */
  scrollLeft: number;
  /** ビューポート高さ */
  viewportHeight: number;
  /** ビューポート幅 */
  viewportWidth: number;
  /** 先読みバッファ（px） */
  buffer: number;
}
