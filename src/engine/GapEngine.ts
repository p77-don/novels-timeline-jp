// ============================================================
// GapEngine.ts
// Novels Timeline JP — Gap（時間圧縮）算出
//
// C. の設計判断:
//   timelineOrder の差分を「日数相当値」として扱う。
//   CalendarSettings の月定義から 1年の日数を導出し、
//   年・月・日 の単位に変換する。
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";
import { GapSegment, LayoutNode } from "../types/TimelineTypes";
import { CalendarSettings } from "../types/TimelineTypes";
import { calcYearDays } from "../settings/PluginSettings";
import { GAP_MIN_DAYS } from "./LayoutEngine";

/** Gap1件を構成するのに必要な最小情報 */
interface GapInput {
  before: TimelineEvent;
  after: TimelineEvent;
  /** 時間軸（縦軸）上のSVG Y座標 */
  yBefore: number;
  /** 時間軸（縦軸）上のSVG Y座標 */
  yAfter: number;
}

export class GapEngine {
  private calendar: CalendarSettings;
  private yearDays: number;

  /** 展開中のGapのキー（"fromOrder_toOrder"） */
  private expandedKeys = new Set<string>();

  constructor(calendar: CalendarSettings) {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }

  updateCalendar(calendar: CalendarSettings): void {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }

  // ----------------------------------------------------------
  // Gap一覧を生成する
  // ----------------------------------------------------------

  /**
   * ソート済みイベント一覧と各イベントのY座標から Gap を生成する
   *
   * @param sortedEvents  timelineOrder 昇順でソート済みのイベント
   * @param yPositions    イベントID → SVG Y座標（時間軸位置）のマップ
   * @param threshold     Gap生成条件（日数相当値）
   */
  buildGaps(
    sortedEvents: TimelineEvent[],
    yPositions: Map<string, number>,
    threshold: number
  ): GapSegment[] {
    const gaps: GapSegment[] = [];
    // GAP同士が密集して重なるのを防ぐため、設定値に関わらず
    // 「GAP_MIN_DAYS日未満」は圧縮対象にしない（下限を強制する）
    const effectiveThreshold = Math.max(GAP_MIN_DAYS, threshold);

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const before = sortedEvents[i];
      const after  = sortedEvents[i + 1];
      const diff   = after.timelineOrder - before.timelineOrder;
      // 両端を除いた実際の空き日数で threshold を比較する
      const gapDays = Math.max(0, diff - 1);

      if (gapDays < effectiveThreshold) continue;

      const yBefore = yPositions.get(before.id) ?? 0;
      const yAfter  = yPositions.get(after.id)  ?? 0;

      gaps.push(this.buildGap({ before, after, yBefore, yAfter }));
    }

    return gaps;
  }

  // ----------------------------------------------------------
  // Gap の位置（時間軸Y座標）をノードの実描画位置で更新する
  // ----------------------------------------------------------

  /**
   * buildGaps() 後、LayoutEngine.buildLayout() で確定した LayoutNode 一覧を使って
   * 各 Gap の表示位置（Y座標）を更新する。
   *
   * ノードは「上端(node.y)が時間軸の日付起点、radius分だけ上下に占有」となるよう
   * 描画されるため、Gapの中心は
   *   前イベントノードの【下端】(y + radius) 〜 後イベントノードの【上端】(y - radius)
   * の中間点として算出する。単純に両ノードの y（上端同士）の中間点を取ると、
   * 前イベントノードの描画範囲にGapが重なって見えてしまうため注意する。
   */
  updateGapYPositions(gaps: GapSegment[], nodes: LayoutNode[]): void {
    const orderToNode = new Map<number, LayoutNode>();
    for (const node of nodes) {
      if (!orderToNode.has(node.event.timelineOrder)) {
        orderToNode.set(node.event.timelineOrder, node);
      }
    }

    for (const gap of gaps) {
      const fromNode = orderToNode.get(gap.fromOrder);
      const toNode   = orderToNode.get(gap.toOrder);
      if (!fromNode || !toNode) continue;

      const fromBottomEdge = fromNode.y + fromNode.radius;
      const toTopEdge       = toNode.y - toNode.radius;

      // Gapの表示位置は「前ノードの下端」〜「後ノードの上端」の中間点
      gap.y = (fromBottomEdge + toTopEdge) / 2;
    }
  }

  // ----------------------------------------------------------
  // Gap の展開/収縮
  // ----------------------------------------------------------

  toggleExpand(gap: GapSegment): void {
    const key = this.gapKey(gap);
    if (this.expandedKeys.has(key)) {
      this.expandedKeys.delete(key);
      gap.expanded = false;
    } else {
      this.expandedKeys.add(key);
      gap.expanded = true;
    }
  }

  collapseAll(): void {
    this.expandedKeys.clear();
  }

  /**
   * 現在のGapリストをすべて展開する。
   * buildGaps() で生成済みの GapSegment を受け取り、
   * 各 Gap の key を expandedKeys に登録する。
   */
  expandAll(gaps: GapSegment[]): void {
    for (const gap of gaps) {
      this.expandedKeys.add(this.gapKeyFromOrders(gap.fromOrder, gap.toOrder));
    }
  }

  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------

  private buildGap(input: GapInput): GapSegment {
    const { before, after, yBefore, yAfter } = input;
    const diff = after.timelineOrder - before.timelineOrder;
    const key  = this.gapKeyFromOrders(before.timelineOrder, after.timelineOrder);

    // Gapの「日数」は両端イベントの当日を含まない期間なので diff-1 を使う
    // 例: 5/10 と 5/20 の間に存在しない日は 5/11〜5/19 の9日間
    const gapDays = Math.max(0, diff - 1);

    return {
      fromOrder: before.timelineOrder,
      toOrder:   after.timelineOrder,
      y:         (yBefore + yAfter) / 2,
      label:     this.formatDiff(gapDays),
      expanded:  this.expandedKeys.has(key),
    };
  }

  /**
   * timelineOrder の差分を「年・月・日」の自然言語ラベルに変換する
   *
   * 変換ルール:
   *   diff ÷ yearDays → 年数
   *   残り ÷ 月ごとの日数 → 月数（最大月から順に引き算）
   *   残り → 日数
   *
   * 例（西暦12か月の場合 yearDays=365）:
   *   diff=1   → "1日"
   *   diff=60  → "2か月"
   *   diff=400 → "1年1か月"
   *   diff=730 → "2年"
   */
  formatDiff(diff: number): string {
    if (this.yearDays <= 0 || diff <= 0) return `${diff}日`;

    let remainder = diff;

    // 年
    const years = Math.floor(remainder / this.yearDays);
    remainder -= years * this.yearDays;

    // 月（月定義の順に引き算）
    let months = 0;
    for (const monthDef of this.calendar.months) {
      if (remainder >= monthDef.days) {
        remainder -= monthDef.days;
        months++;
      } else {
        break;
      }
    }

    // 日
    const days = remainder;

    // ラベル組み立て
    const parts: string[] = [];
    if (years > 0)  parts.push(`${years}年`);
    if (months > 0) parts.push(`${months}か月`);
    if (days > 0)   parts.push(`${days}日`);

    return parts.length > 0 ? parts.join("") : "0日";
  }

  private gapKey(gap: GapSegment): string {
    return this.gapKeyFromOrders(gap.fromOrder, gap.toOrder);
  }

  private gapKeyFromOrders(from: number, to: number): string {
    return `${from}_${to}`;
  }
}
