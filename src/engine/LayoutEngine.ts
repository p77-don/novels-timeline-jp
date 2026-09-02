// ============================================================
// LayoutEngine.ts
// Novels Timeline JP — 描画座標計算
//
// v3 レイアウト方針（縦軸タイムライン・左寄せ軸）:
//   時間軸は縦方向（Y）、レーンは時間軸の右側に配置する横方向の列（X）。
//   列の並びは 左から [年][月][GAP][レーン1]...[レーンN] とする。
//   上→過去、下→未来。レーン数は設定値（laneCount）で可変。
//
// 設計ルール:
//   1. 同日（同timelineOrder）のイベントは同じY座標に配置する
//   2. レーンは 1〜laneCount の固定列として扱う（時間軸専用の予約列はない）
//   3. 同X座標（同lane）かつ同Y座標の重なりのみ補正する
//      → Y方向のオフセットではなく、laneを隣の列に移動する
//   4. ノードの「時間軸方向（Y）の占有幅」はサイズ（radius）で決まる固定値とし、
//      「レーン方向（X）の占有幅」は日にちバッジのテキスト長に応じて決まるが、
//      レーン列の幅（LANE_COL_W）を超えないようクランプする。
//      （テキストは常に横書きのまま読めるようにするため、v2の「テキスト長で
//        軸方向に伸びるカプセル」から「列幅にクランプしたカプセル」へ変更）
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";
import { LayoutNode, GapSegment } from "../types/TimelineTypes";
import { DateParser } from "../parser/DateParser";
import { CalendarSettings } from "../types/TimelineTypes";

export const LANE_MIN = 1;

/** レーン1列あたりの幅(px) */
export const LANE_COL_W = 60;
/** 上部固定ヘッダー行（レーン番号ラベル）の高さ(px) */
export const HEADER_H = 36;
/** 年列の幅(px) */
export const YEAR_COL_W = 64;
/** 月列の幅(px) */
export const MONTH_COL_W = 64;
/** GAP専用列の幅(px) */
export const GAP_COL_W = 80;
/** 左固定列（年・月・GAP）の合計幅 = レーン列が開始するSVG X座標 */
export const LANES_START_X = YEAR_COL_W + MONTH_COL_W + GAP_COL_W;
/** 時間軸（縦線）のSVG X座標 — 月列とGAP列の境界に配置する */
export const AXIS_X = YEAR_COL_W + MONTH_COL_W;

/**
 * サイズ倍率（小=1 を基準に、中=1.5倍、大=2倍）。
 * ノードの時間軸方向(Y)の半径はこの倍率で決まる。
 */
const SIZE_MULTIPLIER: Record<string, number> = {
  small: 1, medium: 1.5, big: 2,
};
/** 「小」サイズにおける基準半径(px)（等倍のとき） */
const BASE_UNIT_HALF_HEIGHT = 8;
/** タイムライン開始Y座標(px) — 上部ヘッダーと重ならないよう余白を確保 */
const START_Y                = HEADER_H + 20;
const MIN_Y_GAP               = 46;  // 隣接イベント間の最小Y間隔(px)
const Y_SCALE                 = 4.0; // 通常描画時の timelineOrder差 → px (1日=4px)
/**
 * ノード下端と次のノード上端の間に必ず確保する余白(px)。
 * ノードの時間軸方向(Y)の占有幅はradius由来の固定値のため、
 * サイズ違いのノード同士でも一定の余白を確保できるようにする。
 */
const NODE_EDGE_PADDING       = 30;
/** Gapとして圧縮できる最小日数。これ未満は圧縮対象にしない（GAP同士の重なり防止） */
export const GAP_MIN_DAYS     = 3;
/**
 * Gap圧縮時の高さ(px) — 常に「3日分」に相当する高さで固定表示する。
 * GAP同士が密集して重なるのを防ぐため、基準高さの1.5倍を表示高さとする。
 */
export const GAP_SLOT_HEIGHT  = Math.max(MIN_Y_GAP, GAP_MIN_DAYS * Y_SCALE) * 1.5;
export const EXPANDED_PX_PER_DAY = 20;  // Gap展開時の1日あたり高さ(px)
export const EXPANDED_MIN_HEIGHT = 120; // Gap展開時の最小高さ(px) — 圧縮時より必ず大きくする
/** 最初のイベントノードが時間軸の起点(0位置)に重ならないよう設ける先行日数 */
const LEAD_DAYS_BEFORE_FIRST = 3;

// ------------------------------------------------------------
// ノード表示サイズの共通計算（Renderer・GapEngine 双方から参照する）
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

/** ノード（日にちバッジ）の描画幅(px)を見積もる（レーン列内でのクランプ前の理想値） */
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
    laneCount: number,
    gaps: GapSegment[],
    gapCompression: boolean
  ): LayoutNode[] {
    if (sortedEvents.length === 0) return [];

    // ① 同日グループにまとめる
    const dayGroups = this.groupByDay(sortedEvents);

    // ② Y座標を「日付ごとに1行」で算出
    const yByOrder = this.calcYByDayGroup(dayGroups, gaps, gapCompression);

    // ③ 各グループ内でlane衝突を回避して LayoutNode を生成
    const nodes: LayoutNode[] = [];
    for (const group of dayGroups) {
      const y = yByOrder.get(group.order) ?? 0;
      this.resolveGroupLayout(group.events, y, laneCount, nodes);
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
  // ② 日付グループ単位でY座標を計算（1日 = 1行）
  // ----------------------------------------------------------

  private calcYByDayGroup(
    groups: Array<{ order: number; events: TimelineEvent[] }>,
    gaps: GapSegment[],
    gapCompression: boolean
  ): Map<number, number> {
    const yMap = new Map<number, number>();
    if (groups.length === 0) return yMap;

    let currentY = START_Y;
    // 最初のイベントは時間軸の起点(0位置)に重ならないよう、
    // 「先行日数(LEAD_DAYS_BEFORE_FIRST)分」の余白を空けてから配置する
    currentY += Math.max(MIN_Y_GAP, LEAD_DAYS_BEFORE_FIRST * Y_SCALE);
    yMap.set(groups[0].order, currentY);

    // 直前グループ内で最も半径の大きいノードの時間軸方向占有幅(px)。
    // ノードはY方向中心を基準に radius 分だけ上下に描画されるため、
    // 次グループの開始Yがこれより手前だとサイズ違いのノード同士が重なってしまう。
    let prevGroupMaxHeight = this.groupMaxNodeHeight(groups[0].events);

    for (let i = 1; i < groups.length; i++) {
      const prev      = groups[i - 1];
      const cur       = groups[i];
      const orderDiff = cur.order - prev.order;
      // 直前ノードの下端 + 余白 を下回らないよう下限を設ける
      // （small/medium/big いずれのサイズでも重なりを防ぐ）
      const minHeightAwareGap = prevGroupMaxHeight + NODE_EDGE_PADDING;

      if (gapCompression) {
        const matchingGap = gaps.find(
          (g) => g.fromOrder === prev.order && g.toOrder === cur.order
        );
        if (matchingGap) {
          const gapHeight = matchingGap.expanded
            ? Math.max(EXPANDED_MIN_HEIGHT, orderDiff * EXPANDED_PX_PER_DAY)
            : GAP_SLOT_HEIGHT;
          currentY += Math.max(gapHeight, minHeightAwareGap);
        } else {
          currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE, minHeightAwareGap);
        }
      } else {
        currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE, minHeightAwareGap);
      }

      yMap.set(cur.order, currentY);
      prevGroupMaxHeight = this.groupMaxNodeHeight(cur.events);
    }

    return yMap;
  }

  /** グループ内イベントのうち、最も時間軸方向の占有幅(radius*2)が大きいノードの値(px)を返す */
  private groupMaxNodeHeight(events: TimelineEvent[]): number {
    let maxHeight = 0;
    for (const event of events) {
      const height = this.calcRadius(event.size) * 2;
      if (height > maxHeight) maxHeight = height;
    }
    return maxHeight;
  }

  // ----------------------------------------------------------
  // ③ グループ内レイアウト
  //    - 同laneの衝突はlaneをずらして回避（1〜laneCountの範囲内）
  // ----------------------------------------------------------

  private resolveGroupLayout(
    events: TimelineEvent[],
    y: number,
    laneCount: number,
    out: LayoutNode[]
  ): void {
    // このグループで使用済みのlane番号
    const usedLanes = new Set<number>();
    const resolved: Array<{ event: TimelineEvent; effectiveLane: number }> = [];

    for (const event of events) {
      const lane = this.findFreeLane(event.lane, usedLanes, laneCount);
      usedLanes.add(lane);
      resolved.push({ event, effectiveLane: lane });
    }

    // LayoutNode を生成
    for (const { event, effectiveLane } of resolved) {
      const x      = this.calcX(effectiveLane, laneCount);
      const radius = this.calcRadius(event.size);
      out.push({ event, x, y, radius });
    }
  }

  /**
   * 指定laneから最も近い未使用laneを探す（1〜laneCountの範囲のみ）。
   * 範囲外に押し出された場合は、範囲内で最初に見つかった空きlaneを使う。
   * 全レーンが埋まっている場合は指定laneをそのまま返す（重なりを許容）。
   */
  private findFreeLane(startLane: number, usedLanes: Set<number>, laneCount: number): number {
    const laneMax       = Math.max(LANE_MIN, laneCount);
    const clampedStart  = Math.max(LANE_MIN, Math.min(laneMax, startLane));

    if (!usedLanes.has(clampedStart)) return clampedStart;

    for (let delta = 1; delta < laneMax; delta++) {
      for (const candidate of [clampedStart + delta, clampedStart - delta]) {
        if (candidate < LANE_MIN || candidate > laneMax) continue;
        if (!usedLanes.has(candidate)) return candidate;
      }
    }
    return clampedStart; // フォールバック（全レーン使用済み・重なりを許容）
  }

  // ----------------------------------------------------------
  // Y座標マップ（GapEngine・orderFromViewportY 用の公開API）
  // ----------------------------------------------------------

  /**
   * GapEngineに渡すための「イベントID → Y座標」マップを返す。
   * buildLayout より前に呼ばれるため、Gap情報なしで算出する暫定版。
   */
  calcYPositions(
    sortedEvents: TimelineEvent[],
    gaps: GapSegment[],
    gapCompression: boolean
  ): Map<string, number> {
    const groups   = this.groupByDay(sortedEvents);
    const yByOrder = this.calcYByDayGroup(groups, gaps, gapCompression);

    const yMap = new Map<string, number>();
    for (const group of groups) {
      const y = yByOrder.get(group.order) ?? 0;
      for (const event of group.events) {
        yMap.set(event.id, y);
      }
    }
    return yMap;
  }

  /** SVG全体の幅(px)。レーン数（設定値）にのみ依存し、イベント数では変化しない固定値。 */
  calcTotalWidth(laneCount: number): number {
    return LANES_START_X + Math.max(LANE_MIN, laneCount) * LANE_COL_W + 24;
  }

  /** SVG全体の高さ(px)。イベントの時間軸方向の配置に応じて動的に変化する。 */
  calcTotalHeight(nodes: LayoutNode[]): number {
    if (nodes.length === 0) return 600;
    return Math.max(...nodes.map((n) => n.y)) + 140;
  }

  /** レーン番号(1〜laneCount) → SVG X座標（列の中心） */
  calcX(lane: number, laneCount: number): number {
    const laneMax = Math.max(LANE_MIN, laneCount);
    const clamped = Math.max(LANE_MIN, Math.min(laneMax, lane));
    return LANES_START_X + (clamped - LANE_MIN) * LANE_COL_W + LANE_COL_W / 2;
  }

  calcRadius(size: string): number {
    const multiplier = SIZE_MULTIPLIER[size] ?? SIZE_MULTIPLIER["medium"];
    return BASE_UNIT_HALF_HEIGHT * multiplier;
  }

  /**
   * クリック位置(ビューポートY)から日付文字列を逆算する。
   *
   * 【設計方針】
   * - nodes[i].y は calcYByDayGroup が生成した SVGユーザー座標（実際の描画Y、ノード上端）。
   * - クリック位置 svgY は TimelineRenderer.clientYToSvgY() で変換済みの
   *   SVGユーザー座標（ボードズームを考慮済み）を渡すこと。
   * - Gap展開/折りたたみ状態に関係なく、nodes の y 値は常に正しい描画位置を示す。
   * - 区間ごとの px/日 定数で orderDiff を復元し、最初のイベントの order を基点に加算する。
   */
  orderFromViewportY(
    // svgY = clientYToSvgY() で変換済みのSVGユーザー座標（スクロール込み絶対Y）
    svgY: number,
    nodes: LayoutNode[],
    gaps: GapSegment[],
    gapCompression: boolean,
    calendarPrefix = ""
  ): string {
    if (nodes.length === 0) {
      return this.orderToDateString(0, calendarPrefix);
    }

    // ① ユニークな (order, y) エントリをノードから生成
    //    同日ノードは同じ y を持つので重複排除する
    const seen = new Map<number, number>(); // order → svgY
    for (const node of nodes) {
      if (!seen.has(node.event.timelineOrder)) {
        seen.set(node.event.timelineOrder, node.y);
      }
    }
    const entries = Array.from(seen.entries())
      .map(([order, y]) => ({ order, vy: y }))
      .sort((a, b) => a.vy - b.vy);

    // ② 境界チェック
    const first = entries[0];
    const last  = entries[entries.length - 1];

    if (svgY <= first.vy) {
      return this.orderToDateString(Math.max(0, first.order - 1), calendarPrefix);
    }
    if (svgY >= last.vy) {
      return this.orderToDateString(last.order + 1, calendarPrefix);
    }

    // ③ 区間を特定して order を計算
    for (let i = 0; i < entries.length - 1; i++) {
      const cur  = entries[i];
      const next = entries[i + 1];
      if (svgY < cur.vy || svgY > next.vy) continue;

      const segH = next.vy - cur.vy;
      if (segH <= 0) {
        return this.orderToDateString(cur.order, calendarPrefix);
      }

      const dy         = svgY - cur.vy;
      const orderDiff  = next.order - cur.order;

      // t = dy/segH（実際のセグメント高さで割る）を使うことで
      // MIN_Y_GAP / EXPANDED_MIN_HEIGHT の影響を完全に吸収する。
      const t = dy / segH;
      const rawOrder = Math.round(cur.order + t * orderDiff);
      const estimatedOrder = Math.max(cur.order, Math.min(next.order, rawOrder));
      return this.orderToDateString(estimatedOrder, calendarPrefix);
    }

    // フォールバック: 最近傍エントリのorderを返す
    let nearest = entries[0];
    let minDist = Math.abs(svgY - entries[0].vy);
    for (const e of entries) {
      const d = Math.abs(svgY - e.vy);
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
