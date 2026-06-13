// ============================================================
// LayoutEngine.ts
// Novels Timeline JP — 描画座標計算
//
// 設計ルール:
//   1. 同日（同timelineOrder）のイベントは同じY座標に配置する
//   2. lane=0 はイベント配置禁止（時間軸専用）
//      → lane=0 のイベントは同日の空きlaneに自動割り当て
//   3. 同X座標（同lane）かつ同Y座標の重なりのみ補正する
//      → Y方向のオフセットではなく、laneを隣に移動する
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";
import { LayoutNode, GapSegment } from "../types/TimelineTypes";
import { DateParser } from "../parser/DateParser";
import { CalendarSettings } from "../types/TimelineTypes";

const LANE_WIDTH            = 40;   // レーン幅(px)
const BASE_RADIUS: Record<string, number> = {
  small: 8, medium: 12, big: 18,
};
const TOP_MARGIN            = 110;  // 上部マージン(px) — ルーラー分の余白
const MIN_Y_GAP             = 40;   // 隣接イベント間の最小Y間隔(px)
const COMPRESSED_GAP_HEIGHT = 40;   // Gap圧縮時の固定高さ(px)
const Y_SCALE               = 4.0;  // 通常描画時の timelineOrder差 → px (1日=4px)
const EXPANDED_PX_PER_DAY   = 20;   // Gap展開時の1日あたり高さ(px)
const EXPANDED_MIN_HEIGHT   = 120;  // Gap展開時の最小高さ(px) — 圧縮時より必ず大きくする

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
    centerX: number,
    nodeScale: number,
    gaps: GapSegment[],
    gapCompression: boolean
  ): LayoutNode[] {
    if (sortedEvents.length === 0) return [];

    // ① 同日グループにまとめる
    const dayGroups = this.groupByDay(sortedEvents);

    // ② Y座標を「日付ごとに1行」で算出
    const yByOrder = this.calcYByDayGroup(dayGroups, gaps, gapCompression);

    // ③ 各グループ内でlane=0を解決し、X衝突を回避して LayoutNode を生成
    const nodes: LayoutNode[] = [];
    for (const group of dayGroups) {
      const y = yByOrder.get(group.order) ?? 0;
      this.resolveGroupLayout(group.events, y, centerX, nodeScale, nodes);
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

    let currentY = TOP_MARGIN;
    yMap.set(groups[0].order, currentY);

    for (let i = 1; i < groups.length; i++) {
      const prev      = groups[i - 1];
      const cur       = groups[i];
      const orderDiff = cur.order - prev.order;

      if (gapCompression) {
        const matchingGap = gaps.find(
          (g) => g.fromOrder === prev.order && g.toOrder === cur.order
        );
        if (matchingGap) {
          currentY += matchingGap.expanded
            ? Math.max(EXPANDED_MIN_HEIGHT, orderDiff * EXPANDED_PX_PER_DAY)
            : COMPRESSED_GAP_HEIGHT;
        } else {
          currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE);
        }
      } else {
        currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE);
      }

      yMap.set(cur.order, currentY);
    }

    return yMap;
  }

  // ----------------------------------------------------------
  // ③ グループ内レイアウト
  //    - lane=0 を自動的に空きlaneへ移動
  //    - 同laneの衝突はlaneをずらして回避
  // ----------------------------------------------------------

  private resolveGroupLayout(
    events: TimelineEvent[],
    y: number,
    centerX: number,
    nodeScale: number,
    out: LayoutNode[]
  ): void {
    // このグループで使用済みのlane番号
    const usedLanes = new Set<number>();

    // lane=0 以外を先に確定
    const resolved: Array<{ event: TimelineEvent; effectiveLane: number }> = [];

    for (const event of events) {
      if (event.lane !== 0) {
        let lane = event.lane;
        // 同laneに既存ノードがある場合は最近傍の空きlaneへ
        lane = this.findFreeLane(lane, usedLanes);
        usedLanes.add(lane);
        resolved.push({ event, effectiveLane: lane });
      }
    }

    // lane=0 のイベントを後から処理（0に近い空きlaneを割り当て）
    for (const event of events) {
      if (event.lane === 0) {
        const lane = this.findFreeLane(0, usedLanes);
        usedLanes.add(lane);
        resolved.push({ event, effectiveLane: lane });
      }
    }

    // LayoutNode を生成
    for (const { event, effectiveLane } of resolved) {
      const x      = this.calcX(effectiveLane, centerX);
      const radius = this.calcRadius(event.size, nodeScale);
      out.push({ event, x, y, radius });
    }
  }

  /**
   * 指定laneから最も近い未使用laneを探す。
   * startLane=0 の場合は 1 → -1 → 2 → -2 の順に探す（0は時間軸予約）。
   */
  private findFreeLane(startLane: number, usedLanes: Set<number>): number {
    if (startLane === 0) {
      // lane=0 のイベント → 1, -1, 2, -2, 3, -3 ... の順で探す
      for (let n = 1; n <= 20; n++) {
        for (const candidate of [n, -n]) {
          if (!usedLanes.has(candidate)) return candidate;
        }
      }
      return 1; // フォールバック
    }

    // lane≠0 のイベント → 指定laneが空いていればそのまま使う
    if (!usedLanes.has(startLane)) return startLane;

    // 衝突時は指定laneから外側へ交互に探す（0は必ず飛ばす）
    for (let delta = 1; delta <= 20; delta++) {
      for (const candidate of [startLane + delta, startLane - delta]) {
        if (candidate !== 0 && !usedLanes.has(candidate)) return candidate;
      }
    }
    return startLane > 0 ? startLane + 1 : startLane - 1; // フォールバック
  }

  // ----------------------------------------------------------
  // Y座標マップ（GapEngine・yToDateString 用の公開API）
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

  calcTotalHeight(nodes: LayoutNode[]): number {
    if (nodes.length === 0) return 600;
    return Math.max(...nodes.map((n) => n.y)) + 120;
  }

  calcX(lane: number, centerX: number): number {
    // 時間軸セル幅 = LANE_WIDTH * 2 のため、
    // lane=0  → centerX（時間軸中央）
    // lane>0  → 時間軸右端 + (lane-1)*LANE_WIDTH + LANE_WIDTH/2（セル中央）
    //         = centerX + LANE_WIDTH/2 + lane * LANE_WIDTH
    // lane<0  → 時間軸左端 - |lane|*LANE_WIDTH + LANE_WIDTH/2（セル中央）
    //         = centerX - LANE_WIDTH/2 + lane * LANE_WIDTH
    if (lane === 0) return centerX;
    if (lane > 0)   return centerX + LANE_WIDTH / 2 + lane * LANE_WIDTH;
    return               centerX - LANE_WIDTH / 2 + lane * LANE_WIDTH;
  }

  calcRadius(size: string, nodeScale: number): number {
    const base = BASE_RADIUS[size] ?? BASE_RADIUS["medium"];
    return base * nodeScale;
  }

  /**
   * D. SVGのY座標 → timelineOrder → date 文字列 への逆算
   *
   * @param calendarPrefix  暦プレフィックス（例: "帝国暦"）。
   *                        呼び出し元で既存イベントのprefixを渡すこと。
   */
  yToDateString(
    clickY: number,
    sortedEvents: TimelineEvent[],
    gaps: GapSegment[],
    gapCompression: boolean,
    calendarPrefix = ""
  ): string {
    if (sortedEvents.length === 0) {
      return this.orderToDateString(0, calendarPrefix);
    }

    const groups   = this.groupByDay(sortedEvents);
    const yByOrder = this.calcYByDayGroup(groups, gaps, gapCompression);

    const yEntries = Array.from(yByOrder.entries())
      .map(([order, y]) => ({ order, y }))
      .sort((a, b) => a.y - b.y);

    if (clickY <= yEntries[0].y) {
      return this.orderToDateString(Math.max(0, yEntries[0].order - 1), calendarPrefix);
    }
    if (clickY >= yEntries[yEntries.length - 1].y) {
      return this.orderToDateString(yEntries[yEntries.length - 1].order + 1, calendarPrefix);
    }

    for (let i = 0; i < yEntries.length - 1; i++) {
      const cur  = yEntries[i];
      const next = yEntries[i + 1];
      if (clickY >= cur.y && clickY <= next.y) {
        const t = (next.y - cur.y) > 0 ? (clickY - cur.y) / (next.y - cur.y) : 0;
        const estimatedOrder = Math.round(cur.order + t * (next.order - cur.order));
        return this.orderToDateString(estimatedOrder, calendarPrefix);
      }
    }

    return this.orderToDateString(0, calendarPrefix);
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
