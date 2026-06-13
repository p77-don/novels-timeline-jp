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
import { GapSegment } from "../types/TimelineTypes";
import { CalendarSettings } from "../types/TimelineTypes";
import { calcYearDays } from "../settings/PluginSettings";

/** Gap1件を構成するのに必要な最小情報 */
interface GapInput {
  before: TimelineEvent;
  after: TimelineEvent;
  yBefore: number;
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
   * @param yPositions    イベントID → SVG Y座標のマップ
   * @param threshold     Gap生成条件（日数相当値）
   */
  buildGaps(
    sortedEvents: TimelineEvent[],
    yPositions: Map<string, number>,
    threshold: number
  ): GapSegment[] {
    const gaps: GapSegment[] = [];

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const before = sortedEvents[i];
      const after  = sortedEvents[i + 1];
      const diff   = after.timelineOrder - before.timelineOrder;
      // 両端を除いた実際の空き日数で threshold を比較する
      const gapDays = Math.max(0, diff - 1);

      if (gapDays < threshold) continue;

      const yBefore = yPositions.get(before.id) ?? 0;
      const yAfter  = yPositions.get(after.id)  ?? 0;

      gaps.push(this.buildGap({ before, after, yBefore, yAfter }));
    }

    return gaps;
  }

  // ----------------------------------------------------------
  // Gap の Y 座標を正式Y座標マップで更新する
  // ----------------------------------------------------------

  /**
   * buildGaps() 後に calcYPositions(gap考慮済み) で再計算したY座標で
   * 各 Gap の y（表示位置）を更新する。
   *
   * Gap の y = 前後イベントのY座標の中間点
   * これにより「折りたたみ時」と「展開時」で正しい位置に表示される。
   */
  updateGapYPositions(
    gaps: GapSegment[],
    finalYMap: Map<string, number>,
    sortedEvents: TimelineEvent[]
  ): void {
    const orderToId = new Map<number, string>();
    for (const event of sortedEvents) {
      if (!orderToId.has(event.timelineOrder)) {
        orderToId.set(event.timelineOrder, event.id);
      }
    }

    for (const gap of gaps) {
      const fromId = orderToId.get(gap.fromOrder);
      const toId   = orderToId.get(gap.toOrder);
      if (fromId === undefined || toId === undefined) continue;
      const yFrom = finalYMap.get(fromId);
      const yTo   = finalYMap.get(toId);
      if (yFrom !== undefined && yTo !== undefined) {
        // Gap帯の中央（日付ラベルとの重なりを避けるため純粋な中間点ではなく
        // 前イベントから一定の余白を取った位置に配置する）
        const GAP_TOP_MARGIN = 30; // 前イベントの日付ラベル下端からの余白
        gap.y = yFrom + GAP_TOP_MARGIN + (yTo - yFrom - GAP_TOP_MARGIN) / 2;
      }
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
