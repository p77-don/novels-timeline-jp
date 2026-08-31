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

  /**
   * 表示タイトル。フロントマターの NTJP_event_title に対応する。
   * 後方互換: NTJP_event_title が未設定の古いノートについては
   * ファイル名から番号部分を除いたものにフォールバックする。
   */
  displayTitle: string;

  /** NTJP_date フィールドの生文字列 例: "帝国暦1345年5月12日" */
  date: string;

  /**
   * 描画用内部時系列値
   * date から DateParser が生成。Markdown には保存しない。
   * 算出式: 年 * (1年の総日数) + 月までの累積日数 + 日
   */
  timelineOrder: number;

  /** レーン番号（1〜10）。時間軸は横軸となり、レーンは縦方向の行として扱われる */
  lane: number;

  /** ノードの形状（NTJP_node フィールドに対応） */
  size: EventSize;

  /**
   * ノードの色を表す値。フロントマターの NTJP_colors に対応する。
   * 通常は「配色セット（ColorPreset）」のIDを保持する（一括変更を可能にするため）。
   * 後方互換のため、配色セット導入前に作成されたノートに残る
   * 生のHEXカラーコード（例: "#4A90E2"）もそのまま解釈できる。
   * 実際の色解決は ColorPresetStore.resolve() が行う。
   */
  color: string;

  /** 登場人物一覧（NTJP_characters） */
  characters: string[];

  /** 場所一覧（NTJP_locations） */
  locations: string[];

  /** イベント概要（NTJP_summary） */
  summary?: string;

  /** リンク先イベントID一覧（NTJP_links のWikilinkから抽出） */
  links: string[];

  /** Vaultルートからの相対ファイルパス */
  filePath: string;

  /** パースエラー種別（正常時は undefined） */
  error?: TimelineEventError;
}

export type TimelineEventError =
  | "invalid_date"
  | "missing_required_field";

// ------------------------------------------------------------
// 配色セット（ノード色＋文字色のプリセット）
// JSON ファイルとして保存し、専用モーダルで作成・編集する。
// イベントノートの color フィールドにはこの配色セットのIDを保存し、
// 実際の色（ノード色・文字色）は描画時に ColorPresetStore.resolve() で解決する。
// これにより、配色セットを編集すれば参照している全イベントの色を
// 一括で変更できる（イベントノート自体には生のHEX値を書き込まない）。
// ------------------------------------------------------------

export interface ColorPreset {
  /** 一意なID（作成時刻ベースなど） */
  id: string;
  /** プリセット名（例: "主人公", "敵対勢力", "回想"） */
  name: string;
  /** ノード（図形）の色 */
  nodeColor: string;
  /** ノード内テキスト（日にちバッジ）の色 */
  textColor: string;
}

export interface ColorPresetFile {
  presets: ColorPreset[];
}

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
  /**
   * 時間軸上のSVG座標（Gap表示位置）。
   * 時間軸は横軸のため、実体は「SVG X座標」である
   * （フィールド名 y は互換性のため維持）。
   */
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
