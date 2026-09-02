// ============================================================
// LayoutEngine.ts
// Novels Timeline JP — 描画座標計算
//
// v2 レイアウト方針（横軸タイムライン）:
//   時間軸は横方向（X）、レーンは縦方向（Y・1〜10の行）に変更。
//
// 設計ルール:
//   1. 同日（同timelineOrder）のイベントは同じX座標に配置する
//   2. レーンは 1〜10 の固定行として扱う（時間軸専用の予約レーンはない）
//   3. 同Y座標（同lane）かつ同X座標の重なりのみ補正する
//      → X方向のオフセットではなく、laneを隣の行に移動する
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";
import { LayoutNode, GapSegment } from "../types/TimelineTypes";
import { DateParser } from "../parser/DateParser";
import { CalendarSettings } from "../types/TimelineTypes";

export const LANE_MIN = 1;
export const LANE_MAX = 10;
export const LANE_COUNT = LANE_MAX - LANE_MIN + 1;

/** レーン1行あたりの高さ(px) */
export const ROW_HEIGHT = 50;
/** 上部マージン(px) — 日付ルーラー分の余白（年・月表示、日は表示しない） */
export const HEADER_HEIGHT = 64;
/** 時間軸とイベントレーンの間に確保する「GAP専用レーン」の高さ(px) */
export const GAP_ROW_HEIGHT = 40;
/** イベントレーン（lane 1）が開始するSVG Y座標 */
export const LANES_START_Y = HEADER_HEIGHT + GAP_ROW_HEIGHT;
/** 左側固定列（レーン番号表示エリア）の幅(px) */
export const LANE_LABEL_W = 56;

/**
 * サイズ倍率（小=1 を基準に、中=1.5倍、大=2倍）。
 * ノードの幅・高さは共通してこの倍率で決まる。
 */
const SIZE_MULTIPLIER: Record<string, number> = {
  small: 1, medium: 1.5, big: 2,
};
/** 「小」サイズにおける基準半径(px)（等倍のとき） */
const BASE_UNIT_HALF_HEIGHT = 8;
/** タイムライン開始X座標(px) — 左固定列と重ならないよう余白を確保 */
const START_X               = LANE_LABEL_W + 20;
const MIN_X_GAP              = 46;   // 隣接イベント間の最小X間隔(px)
const X_SCALE                = 4.0;  // 通常描画時の timelineOrder差 → px (1日=4px)
/**
 * ノード右端と次のノード左端の間に必ず確保する余白(px)。
 * これが無いと big/medium サイズのノード幅が列間隔(MIN_X_GAP等)を
 * 超えたときに隣接ノード同士が重なり、関係線もノードの下に隠れてしまう。
 */
const NODE_EDGE_PADDING      = 50;
/** Gapとして圧縮できる最小日数。これ未満は圧縮対象にしない（GAP同士の重なり防止） */
export const GAP_MIN_DAYS    = 3;
/**
 * Gap圧縮時の幅(px) — 常に「3日分」に相当する幅で固定表示する。
 * GAP同士が密集して重なるのを防ぐため、基準幅の1.5倍を表示幅とする。
 */
export const GAP_SLOT_WIDTH  = Math.max(MIN_X_GAP, GAP_MIN_DAYS * X_SCALE) * 1.5;
export const EXPANDED_PX_PER_DAY    = 20;   // Gap展開時の1日あたり幅(px)
export const EXPANDED_MIN_WIDTH     = 120;  // Gap展開時の最小幅(px) — 圧縮時より必ず大きくする
/** 最初のイベントノードが時間軸の起点(0位置)に重ならないよう設ける先行日数 */
const LEAD_DAYS_BEFORE_FIRST = 3;

// ------------------------------------------------------------
// ノード表示サイズの共通計算（Renderer・GapEngine 双方から参照する）
//
// ノードは「左端(node.x)が時間軸の日付起点」となるよう描画されるため、
// Gapの表示位置（前後ノードの間の空白の中心）を正しく算出するには、
// ノードの実際の描画幅を Renderer 以外からも参照できる必要がある。
// ------------------------------------------------------------

/** ノードに表示する日にちテキスト（例: "12日"） */
export function dayLabelForEvent(event: TimelineEvent): string {
  const match = /\/([0-9]+)$/.exec(event.date);
  const day   = match ? match[1] : "?";
  return `${day}日`;
}

export function estimateNodeFontSize(radius: number): number {
  return Math.max(9, Math.min(22, radius * 1.15));
}

/** ノード（日にちバッジ）の描画幅(px)を見積もる */
export function estimateNodePillWidth(event: TimelineEvent, radius: number): number {
  const text     = dayLabelForEvent(event);
  const fontSize = estimateNodeFontSize(radius);
  return text.length * fontSize * 0.62 + fontSize * 0.9;
}

export class LayoutEngine {
  private dateParser: DateParser;

  constructor(calendar: CalendarSettings) {
    this.dateParser = new DateParser(calendar);
  }

  updateCalendar(calendar: CalendarSettings): void {
    this.dateParser.updateCalendar(calendar);
  }

  // ----------------------------------------------------------
  // メイン：イベント一覧 → LayoutNode 一覧
  // ----------------------------------------------------------

  buildLayout(
    sortedEvents: TimelineEvent[],
    lanesStartY: number,
    gaps: GapSegment[],
    gapCompression: boolean
  ): LayoutNode[] {
    if (sortedEvents.length === 0) return [];

    // ① 同日グループにまとめる
    const dayGroups = this.groupByDay(sortedEvents);

    // ② X座標を「日付ごとに1列」で算出
    const xByOrder = this.calcXByDayGroup(dayGroups, gaps, gapCompression);

    // ③ 各グループ内でlane衝突を回避して LayoutNode を生成
    const nodes: LayoutNode[] = [];
    for (const group of dayGroups) {
      const x = xByOrder.get(group.order) ?? 0;
      this.resolveGroupLayout(group.events, x, lanesStartY, nodes);
    }

    return nodes;
  }

  // ----------------------------------------------------------
  // ① 同日グループ化
  // ----------------------------------------------------------

  private groupByDay(sortedEvents: TimelineEvent[]): Array<{
    order: number;
    events: TimelineEvent[];
  }> {
    const groups: Array<{ order: number; events: TimelineEvent[] }> = [];
    let current: { order: number; events: TimelineEvent[] } | null = null;

    for (const event of sortedEvents) {
      if (!current || current.order !== event.timelineOrder) {
        current = { order: event.timelineOrder, events: [] };
        groups.push(current);
      }
      current.events.push(event);
    }
    return groups;
  }

  // ----------------------------------------------------------
  // ② 日付グループ単位でX座標を計算（1日 = 1列）
  // ----------------------------------------------------------

  private calcXByDayGroup(
    groups: Array<{ order: number; events: TimelineEvent[] }>,
    gaps: GapSegment[],
    gapCompression: boolean
  ): Map<number, number> {
    const xMap = new Map<number, number>();
    if (groups.length === 0) return xMap;

    let currentX = START_X;
    // 最初のイベントは時間軸の起点(0位置)に重ならないよう、
    // 「先行日数(LEAD_DAYS_BEFORE_FIRST)分」の余白を空けてから配置する
    currentX += Math.max(MIN_X_GAP, LEAD_DAYS_BEFORE_FIRST * X_SCALE);
    xMap.set(groups[0].order, currentX);

    // 直前グループ内で最も幅の広いノードの描画幅(px)。
    // ノードは左端(x)を起点に右方向へこの幅ぶん描画されるため、
    // 次グループの開始Xがこれより手前だとサイズ違いのノード同士が重なってしまう。
    let prevGroupMaxWidth = this.groupMaxPillWidth(groups[0].events);

    for (let i = 1; i < groups.length; i++) {
      const prev      = groups[i - 1];
      const cur       = groups[i];
      const orderDiff = cur.order - prev.order;
      // 直前ノードの右端 + 余白 を下回らないよう下限を設ける
      // （small/medium/big いずれのサイズでも重なりを防ぐ）
      const minWidthAwareGap = prevGroupMaxWidth + NODE_EDGE_PADDING;

      if (gapCompression) {
        const matchingGap = gaps.find(
          (g) => g.fromOrder === prev.order && g.toOrder === cur.order
        );
        if (matchingGap) {
          const gapWidth = matchingGap.expanded
            ? Math.max(EXPANDED_MIN_WIDTH, orderDiff * EXPANDED_PX_PER_DAY)
            : GAP_SLOT_WIDTH;
          currentX += Math.max(gapWidth, minWidthAwareGap);
        } else {
          currentX += Math.max(MIN_X_GAP, orderDiff * X_SCALE, minWidthAwareGap);
        }
      } else {
        currentX += Math.max(MIN_X_GAP, orderDiff * X_SCALE, minWidthAwareGap);
      }

      xMap.set(cur.order, currentX);
      prevGroupMaxWidth = this.groupMaxPillWidth(cur.events);
    }

    return xMap;
  }

  /** グループ内イベントのうち、最も描画幅が広いノードの幅(px)を返す */
  private groupMaxPillWidth(events: TimelineEvent[]): number {
    let maxWidth = 0;
    for (const event of events) {
      const radius = this.calcRadius(event.size);
      const width  = estimateNodePillWidth(event, radius);
      if (width > maxWidth) maxWidth = width;
    }
    return maxWidth;
  }

  // ----------------------------------------------------------
  // ③ グループ内レイアウト
  //    - 同laneの衝突はlaneをずらして回避（1〜10の範囲内）
  // ----------------------------------------------------------

  private resolveGroupLayout(
    events: TimelineEvent[],
    x: number,
    lanesStartY: number,
    out: LayoutNode[]
  ): void {
    // このグループで使用済みのlane番号
    const usedLanes = new Set<number>();
    const resolved: Array<{ event: TimelineEvent; effectiveLane: number }> = [];

    for (const event of events) {
      const lane = this.findFreeLane(event.lane, usedLanes);
      usedLanes.add(lane);
      resolved.push({ event, effectiveLane: lane });
    }

    // LayoutNode を生成
    for (const { event, effectiveLane } of resolved) {
      const y      = this.calcY(effectiveLane, lanesStartY);
      const radius = this.calcRadius(event.size);
      out.push({ event, x, y, radius });
    }
  }

  /**
   * 指定laneから最も近い未使用laneを探す（1〜10の範囲のみ）。
   * 範囲外に押し出された場合は、範囲内で最初に見つかった空きlaneを使う。
   * 全レーンが埋まっている場合は指定laneをそのまま返す（重なりを許容）。
   */
  private findFreeLane(startLane: number, usedLanes: Set<number>): number {
    const clampedStart = Math.max(LANE_MIN, Math.min(LANE_MAX, startLane));

    if (!usedLanes.has(clampedStart)) return clampedStart;

    for (let delta = 1; delta < LANE_COUNT; delta++) {
      for (const candidate of [clampedStart + delta, clampedStart - delta]) {
        if (candidate < LANE_MIN || candidate > LANE_MAX) continue;
        if (!usedLanes.has(candidate)) return candidate;
      }
    }
    return clampedStart; // フォールバック（全レーン使用済み・重なりを許容）
  }

  // ----------------------------------------------------------
  // X座標マップ（GapEngine・orderFromViewportX 用の公開API）
  // ----------------------------------------------------------

  /**
   * GapEngineに渡すための「イベントID → X座標」マップを返す。
   * buildLayout より前に呼ばれるため、Gap情報なしで算出する暫定版。
   */
  calcXPositions(
    sortedEvents: TimelineEvent[],
    gaps: GapSegment[],
    gapCompression: boolean
  ): Map<string, number> {
    const groups   = this.groupByDay(sortedEvents);
    const xByOrder = this.calcXByDayGroup(groups, gaps, gapCompression);

    const xMap = new Map<string, number>();
    for (const group of groups) {
      const x = xByOrder.get(group.order) ?? 0;
      for (const event of group.events) {
        xMap.set(event.id, x);
      }
    }
    return xMap;
  }

  calcTotalWidth(nodes: LayoutNode[]): number {
    if (nodes.length === 0) return 800;
    return Math.max(...nodes.map((n) => n.x)) + 140;
  }

  /** レーン番号(1〜10) → SVG Y座標（行の中心） */
  calcY(lane: number, lanesStartY: number): number {
    const clamped = Math.max(LANE_MIN, Math.min(LANE_MAX, lane));
    return lanesStartY + (clamped - LANE_MIN) * ROW_HEIGHT + ROW_HEIGHT / 2;
  }

  calcRadius(size: string): number {
    const multiplier = SIZE_MULTIPLIER[size] ?? SIZE_MULTIPLIER["medium"];
    return BASE_UNIT_HALF_HEIGHT * multiplier;
  }

  /**
   * クリック位置(ビューポートX)から日付文字列を逆算する。
   *
   * 【設計方針】
   * - nodes[i].x は calcXByDayGroup が生成した SVGユーザー座標（実際の描画X）。
   * - クリック位置 svgX は TimelineRenderer.clientXToSvgX() で変換済みの
   *   SVGユーザー座標（ボードズームを考慮済み）を渡すこと。
   * - Gap展開/折りたたみ状態に関係なく、nodes の x 値は常に正しい描画位置を示す。
   * - 区間ごとの px/日 定数で orderDiff を復元し、最初のイベントの order を基点に加算する。
   */
  orderFromViewportX(
    // svgX = clientXToSvgX() で変換済みのSVGユーザー座標（スクロール込み絶対X）
    svgX: number,
    nodes: LayoutNode[],
    gaps: GapSegment[],
    gapCompression: boolean,
    calendarPrefix = ""
  ): string {
    if (nodes.length === 0) {
      return this.orderToDateString(0, calendarPrefix);
    }

    // ① ユニークな (order, x) エントリをノードから生成
    //    同日ノードは同じ x を持つので重複排除する
    const seen = new Map<number, number>(); // order → svgX
    for (const node of nodes) {
      if (!seen.has(node.event.timelineOrder)) {
        seen.set(node.event.timelineOrder, node.x);
      }
    }
    const entries = Array.from(seen.entries())
      .map(([order, x]) => ({ order, vx: x }))
      .sort((a, b) => a.vx - b.vx);

    // ② 境界チェック
    const first = entries[0];
    const last  = entries[entries.length - 1];

    if (svgX <= first.vx) {
      return this.orderToDateString(Math.max(0, first.order - 1), calendarPrefix);
    }
    if (svgX >= last.vx) {
      return this.orderToDateString(last.order + 1, calendarPrefix);
    }

    // ③ 区間を特定して order を計算
    for (let i = 0; i < entries.length - 1; i++) {
      const cur  = entries[i];
      const next = entries[i + 1];
      if (svgX < cur.vx || svgX > next.vx) continue;

      const segW = next.vx - cur.vx;
      if (segW <= 0) {
        return this.orderToDateString(cur.order, calendarPrefix);
      }

      const dx        = svgX - cur.vx;
      const orderDiff = next.order - cur.order;

      // t = dx/segW（実際のセグメント幅で割る）を使うことで
      // MIN_X_GAP / EXPANDED_MIN_WIDTH の影響を完全に吸収する。
      const t = dx / segW;
      const rawOrder = Math.round(cur.order + t * orderDiff);
      const estimatedOrder = Math.max(cur.order, Math.min(next.order, rawOrder));
      return this.orderToDateString(estimatedOrder, calendarPrefix);
    }

    // フォールバック: 最近傍エントリのorderを返す
    let nearest = entries[0];
    let minDist = Math.abs(svgX - entries[0].vx);
    for (const e of entries) {
      const d = Math.abs(svgX - e.vx);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return this.orderToDateString(nearest.order, calendarPrefix);
  }

  /**
   * timelineOrder → date 文字列（スラッシュ形式）
   * 例: "1345/5/12"（暦名なし・UIの入力形式と一致させる）
   */
  private orderToDateString(order: number, _calendarPrefix: string): string {
    const parsed = this.dateParser.orderToDate(Math.max(0, order));
    return this.dateParser.formatSlash(parsed);
  }
}
