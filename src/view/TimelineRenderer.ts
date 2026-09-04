// ============================================================
// TimelineRenderer.ts
// Novels Timeline JP — SVG 描画エンジン（縦軸タイムライン版）
//
// v3 変更点:
//   ・時間軸を横軸から縦軸へ変更（Y=時間, X=レーン）
//   ・時間軸は左寄せ配置。列の並びは左から
//     [年][月][GAP][レーン1]...[レーンN]
//   ・上部にレーン番号の固定ヘッダー行（スクロール追従・上部固定）
//   ・左側に年・月・GAPの固定列（スクロール追従・左端固定）
//   ・ノードは「●」ではなく「日にち」を表示するカプセル型バッジ。
//     時間軸方向(Y)の占有幅はサイズ(radius)由来の固定値、
//     レーン方向(X)の占有幅はテキスト長に応じるがレーン列幅にクランプする。
//   ・レーン数は設定値（laneCount）で可変。
// ============================================================

import {
  LayoutNode,
  GapSegment,
  RelationEdge,
  VirtualWindow,
} from "../types/TimelineTypes";
import { NovelsTimelineSettings } from "../settings/PluginSettings";
import { Tooltip }     from "./Tooltip";
import { GapRenderer } from "./GapRenderer";
import { TimelineEvent } from "../types/TimelineTypes";
import { LANE_MIN, LANE_COL_W, HEADER_H, YEAR_COL_W, MONTH_COL_W, GAP_COL_W, LANES_START_X, AXIS_X, GAP_SLOT_HEIGHT, EXPANDED_MIN_HEIGHT, EXPANDED_PX_PER_DAY, dayLabelForEvent, estimateNodeFontSize, nodeRingsForSize, baseNodeRadius, NODE_LABEL_PADDING } from "../engine/LayoutEngine";

const SVG_NS = "http://www.w3.org/2000/svg";

const COLOR = {
  nodeStroke:      "var(--text-normal)",
  nodeFiltered:    "var(--background-modifier-border)",
  nodeTextLight:   "#ffffff",
  errorIcon:       "var(--text-error)",
  calendarHeader:  "var(--text-accent)",
} as const;

// ----------------------------------------------------------
// 時間軸ルーラー（左側固定列）に描画する1行分の日付情報
// ----------------------------------------------------------

export interface DateRow {
  y:              number;   // SVG Y座標（時間軸上の位置）
  day:            number;   // 日（ノード側に表示するため保持のみ）
  month:          number;   // 月番号（例: 5）
  year:           number;   // 年（例: 1345）
  monthLabel:     string;   // 月の表示名（例: "五月" or "5月"）
  calendarPrefix: string;   // 暦プレフィックス（例: "帝国暦"）
}

export interface RenderContext {
  nodes:         LayoutNode[];
  gaps:          GapSegment[];
  edges:         RelationEdge[];
  filteredIds:   Set<string> | null;
  selectedId:    string | null;
  settings:      NovelsTimelineSettings;
  /** SVG全体の幅(px)。レーン数（設定値）にのみ依存する固定値。 */
  totalWidth:    number;
  /** SVG全体の高さ(px)。イベントの時間軸配置に応じて動的に変化する。 */
  totalHeight:   number;
  virtualWindow: VirtualWindow;
  dateRows:      DateRow[];
  onNodeClick:   (event: TimelineEvent, node: LayoutNode, mouseX: number, mouseY: number) => void;
  onNodeHover:   (event: TimelineEvent, node: LayoutNode, mouseX: number, mouseY: number) => void;
  onNodeLeave:   () => void;
  onGapClick:    (gap: GapSegment) => void;
  /** svgY = クリック位置の時間軸座標（日付逆算に使用）、lane = クリック位置のレーン番号 */
  onContextMenu: (svgY: number, mouseX: number, mouseY: number, lane: number) => void;
  onLaneDrop:    (eventId: string, newLane: number) => void;
  /** イベントの color フィールド（配色セットIDまたは生HEX値）を実色に解決する */
  resolveNodeColors: (event: TimelineEvent) => { nodeColor: string; textColor: string };
}

export class TimelineRenderer {
  private svg:         SVGSVGElement;
  private container:   HTMLElement;
  private tooltip:     Tooltip;
  private gapRenderer: GapRenderer;
  private _lastLaneCount = 10; // render() で更新、drag時に参照

  private dragState: {
    active:   boolean;
    eventId:  string;
    startX:   number;
    circle:   SVGGElement | null;
    originalLane: number;
  } = { active: false, eventId: "", startX: 0, circle: null, originalLane: 1 };

  constructor(container: HTMLElement) {
    this.container   = container;
    this.svg         = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    this.svg.setAttribute("xmlns", SVG_NS);
    container.appendChild(this.svg);
    this.tooltip     = new Tooltip(container);
    this.gapRenderer = new GapRenderer();
  }

  // ----------------------------------------------------------
  // メイン描画
  // ----------------------------------------------------------

  render(ctx: RenderContext): void {
    const { settings, totalWidth, totalHeight, virtualWindow } = ctx;

    // 再描画のたびにSVG内のノード要素はすべて作り直されるため、
    // ホバー中だった要素はDOMから消える際に mouseleave が発火せず、
    // Tooltip が「表示されたまま」になってしまう（スクロール時に顕著）。
    // 再描画の起点を問わず、常にここで一旦閉じることで確実に解消する。
    this.tooltip.hide();

    const laneCount  = Math.max(LANE_MIN, settings.laneCount);
    const headerH    = HEADER_H;
    const gapColW    = GAP_COL_W;
    const lanesStartX = LANES_START_X;
    const colW       = LANE_COL_W;
    const axisX      = virtualWindow.scrollLeft + AXIS_X; // 時間軸（垂直線）の位置。年・月・GAP列見出しと同様、
                                                            // 水平スクロールに追従して常に左側へ固定表示する。
    this._lastLaneCount = laneCount;

    this.svg.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);
    this.svg.setAttribute("width",   String(totalWidth));
    this.svg.setAttribute("height",  String(totalHeight));
    // レーン数（設定値）から毎回計算するボード全体の幅・イベント配置から
    // 動的に決まる高さ（いずれも実行時にしか決まらない値）のため、
    // CSSクラス化はできずインライン指定を許容する。
    this.svg.style.minWidth  = `${totalWidth}px`;
    this.svg.style.minHeight = `${totalHeight}px`;

    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    const buffer   = settings.virtualRendering ? virtualWindow.buffer : Infinity;
    const visTop    = virtualWindow.scrollTop  - buffer;
    const visBottom = virtualWindow.scrollTop  + virtualWindow.viewportHeight + buffer;
    const visLeft   = virtualWindow.scrollLeft - buffer;
    const visRight  = virtualWindow.scrollLeft + virtualWindow.viewportWidth  + buffer;

    const defs = document.createElementNS(SVG_NS, "defs");
    this.svg.appendChild(defs);

    // ① レーン列の背景（縞模様）と区切り線
    this.drawLaneColumns(totalHeight, lanesStartX, colW, laneCount);
    // ② 関係線（ノードより先に描画）
    this.drawRelations(ctx, visTop, visBottom);
    // ③ ノード（日にちバッジ）
    this.drawNodes(ctx, visTop, visBottom, visLeft, visRight);
    // ─────────────────────────────────────────────────────────
    // ここから下は「左側固定列」（年・月・時間軸・GAP）。
    // 水平スクロールに追従して常に同じ画面位置に再描画されるため、
    // 下に隠れる形になるレーンの関係線・ノードより後に描画し、
    // 不透明の背景で覆い隠す（透けて見えるのを防ぐ）。
    // ─────────────────────────────────────────────────────────
    // ④ GAP専用列の背景（月列とレーン列の間）
    this.drawGapColumnBackground(totalHeight, axisX, gapColW);
    // ⑤ 時間軸（垂直線）
    this.drawTimeAxis(axisX, totalHeight);
    // ⑥ Gap（GAP専用列内に表示）
    if (settings.gapCompression) {
      this.drawGaps(ctx, visTop, visBottom, axisX, gapColW);
    }
    // ⑦ 年・月ラベル（左側固定列・スクロール追従で常に左端固定表示）
    this.drawDateColumn(ctx, visTop, visBottom, virtualWindow.scrollLeft);
    // ⑧ レーン番号ヘッダー行（上部固定・スクロール追従）
    this.drawLaneHeaderRow(lanesStartX, colW, laneCount, headerH, virtualWindow.scrollTop);
    // ⑨ 左上コーナー（年・月・GAP 列見出し・上下左右どちらのスクロールにも追従）
    this.drawCornerHeader(virtualWindow.scrollLeft, virtualWindow.scrollTop, headerH, settings.calendar.name ?? "");

    this.svg.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
      // clientXToSvgX() / clientYToSvgY() は getScreenCTM() 経由でボードズームを含む
      // 実際の描画スケールを考慮してSVGユーザー座標へ変換する。
      // （e.offsetX/e.offsetY はズーム時にスケールされた値になるため使用不可）
      const svgX = this.clientXToSvgX(e.clientX);
      const lane = this.svgXToLane(svgX, laneCount);
      ctx.onContextMenu(this.clientYToSvgY(e.clientY), e.clientX, e.clientY, lane);
    };
    this.svg.onmousemove = (e: MouseEvent) => {
      this.tooltip.move(e.clientX, e.clientY);
      this.onDragMove(e, ctx);
    };
    this.svg.onmouseup = (e: MouseEvent) => this.onDragEnd(e, ctx);
  }

  // ----------------------------------------------------------
  // GAP専用列の背景（時間軸とレーン列の間の帯）
  // ----------------------------------------------------------

  private drawGapColumnBackground(totalHeight: number, axisX: number, gapColW: number): void {
    // 不透明の下地（水平スクロールで固定表示されるため、下に隠れるレーン内容が
    // 透けて見えないようにする。年・月列と同じ考え方）。
    const base = document.createElementNS(SVG_NS, "rect");
    base.setAttribute("x",      String(axisX));
    base.setAttribute("y",      "0");
    base.setAttribute("width",  String(gapColW));
    base.setAttribute("height", String(totalHeight));
    base.setAttribute("fill",   "var(--background-primary-alt)");
    this.svg.appendChild(base);

    // 見た目の色味（従来からの半透明の帯）。下地の上に重ねる。
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      String(axisX));
    bg.setAttribute("y",      "0");
    bg.setAttribute("width",  String(gapColW));
    bg.setAttribute("height", String(totalHeight));
    bg.setAttribute("fill",   "var(--background-secondary-alt)");
    bg.setAttribute("fill-opacity", "0.4");
    this.svg.appendChild(bg);

    const rightLine = document.createElementNS(SVG_NS, "line");
    rightLine.setAttribute("x1", String(axisX + gapColW));
    rightLine.setAttribute("y1", "0");
    rightLine.setAttribute("x2", String(axisX + gapColW));
    rightLine.setAttribute("y2", String(totalHeight));
    rightLine.setAttribute("stroke",       "var(--background-modifier-border)");
    rightLine.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(rightLine);
  }

  // ----------------------------------------------------------
  // レーン列の背景（縞模様）と区切り線
  // ----------------------------------------------------------

  private drawLaneColumns(totalHeight: number, lanesStartX: number, colW: number, lanes: number): void {
    for (let i = 0; i < lanes; i++) {
      const x = lanesStartX + i * colW;

      if (i % 2 === 1) {
        const bg = document.createElementNS(SVG_NS, "rect");
        bg.setAttribute("x",      String(x));
        bg.setAttribute("y",      "0");
        bg.setAttribute("width",  String(colW));
        bg.setAttribute("height", String(totalHeight));
        bg.setAttribute("fill",   "var(--background-secondary)");
        bg.setAttribute("fill-opacity", "0.5");
        this.svg.appendChild(bg);
      }

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", "0");
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(totalHeight));
      line.setAttribute("stroke",       "var(--background-modifier-border)");
      line.setAttribute("stroke-width", "0.5");
      this.svg.appendChild(line);
    }
    // 右端の境界線
    const rightX = lanesStartX + lanes * colW;
    const rightLine = document.createElementNS(SVG_NS, "line");
    rightLine.setAttribute("x1", String(rightX));
    rightLine.setAttribute("y1", "0");
    rightLine.setAttribute("x2", String(rightX));
    rightLine.setAttribute("y2", String(totalHeight));
    rightLine.setAttribute("stroke",       "var(--background-modifier-border)");
    rightLine.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(rightLine);
  }

  // ----------------------------------------------------------
  // 時間軸（垂直線）— 帯背景 + 中央線
  // ----------------------------------------------------------

  private drawTimeAxis(axisX: number, totalHeight: number): void {
    let defs = this.svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVG_NS, "defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    const gradId = "ntj-axis-grad";
    if (!defs.querySelector(`#${gradId}`)) {
      const grad = document.createElementNS(SVG_NS, "linearGradient");
      grad.setAttribute("id",  gradId);
      grad.setAttribute("x1",  "0%");
      grad.setAttribute("y1",  "0%");
      grad.setAttribute("x2",  "100%");
      grad.setAttribute("y2",  "0%");
      for (const [offset, opacity] of [["0%","0"],["50%","0.12"],["100%","0"]]) {
        const stop = document.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset",      offset);
        stop.setAttribute("stop-color",  "var(--interactive-accent)");
        stop.setAttribute("stop-opacity", opacity);
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
    }

    // 帯背景
    const band = document.createElementNS(SVG_NS, "rect");
    band.setAttribute("x",      String(axisX - 8));
    band.setAttribute("y",      "0");
    band.setAttribute("width",  "16");
    band.setAttribute("height", String(totalHeight));
    band.setAttribute("fill",   `url(#${gradId})`);
    this.svg.appendChild(band);

    // 中央縦線（メイン）
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",           String(axisX));
    line.setAttribute("y1",           "0");
    line.setAttribute("x2",           String(axisX));
    line.setAttribute("y2",           String(totalHeight));
    line.setAttribute("stroke",       "var(--interactive-accent)");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(line);
  }

  // ----------------------------------------------------------
  // 年・月ラベル（左側固定列。スクロール追従で常に左端固定表示）
  // ----------------------------------------------------------

  private drawDateColumn(
    ctx: RenderContext, visTop: number, visBottom: number, scrollLeft: number
  ): void {
    const { dateRows, virtualWindow } = ctx;

    // 背景（年・月列）— レーン内容が透けて見えないようにする
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      String(scrollLeft));
    bg.setAttribute("y",      "0");
    bg.setAttribute("width",  String(YEAR_COL_W + MONTH_COL_W));
    bg.setAttribute("height", String(ctx.totalHeight));
    bg.setAttribute("fill",   "var(--background-primary-alt)");
    this.svg.appendChild(bg);

    if (dateRows.length === 0) return;

    const stickyX = scrollLeft; // 左端固定の基準X
    void virtualWindow;

    let prevYear  = -1;
    let prevMonth = -1;

    for (const row of dateRows) {
      if (row.y < visTop - 60 || row.y > visBottom + 60) {
        prevYear  = row.year;
        prevMonth = row.month;
        continue;
      }

      if (row.year !== prevYear) {
        this.drawYearCell(row.year, row.y, stickyX);
        prevYear  = row.year;
        prevMonth = -1;
      }

      if (row.month !== prevMonth) {
        this.drawMonthCell(row.monthLabel, row.y, stickyX);
        prevMonth = row.month;
      }
    }
  }

  /** 年表示（枠なし・年列の幅ぶんだけ区切り線を引く） */
  private drawYearCell(year: number, y: number, stickyX: number): void {
    const label = `${year}年`;

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",           String(stickyX + 4));
    line.setAttribute("y1",           String(y));
    line.setAttribute("x2",           String(stickyX + YEAR_COL_W));
    line.setAttribute("y2",           String(y));
    line.setAttribute("stroke",       "var(--text-muted)");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", "0.4");
    this.svg.appendChild(line);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(stickyX + 5));
    text.setAttribute("y",                 String(y - 6));
    text.setAttribute("text-anchor",       "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "12");
    text.setAttribute("font-weight",       "700");
    text.setAttribute("fill",              "var(--text-normal)");
    text.textContent = label;
    this.svg.appendChild(text);
  }

  /** 月表示（枠なし・月列の幅ぶんだけ区切り線を引く） */
  private drawMonthCell(monthLabel: string, y: number, stickyX: number): void {
    const colX = stickyX + YEAR_COL_W;

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",               String(colX));
    line.setAttribute("y1",               String(y));
    line.setAttribute("x2",               String(colX + MONTH_COL_W));
    line.setAttribute("y2",               String(y));
    line.setAttribute("stroke",           "var(--text-muted)");
    line.setAttribute("stroke-width",     "0.6");
    line.setAttribute("stroke-opacity",   "0.25");
    line.setAttribute("stroke-dasharray", "3 4");
    this.svg.appendChild(line);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(colX + 5));
    text.setAttribute("y",                 String(y - 6));
    text.setAttribute("text-anchor",       "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "10");
    text.setAttribute("font-weight",       "500");
    text.setAttribute("fill",              "var(--text-muted)");
    text.textContent = monthLabel;
    this.svg.appendChild(text);
  }

  // ----------------------------------------------------------
  // レーン番号ヘッダー行（上部固定。スクロール追従で常に上端固定表示）
  // ----------------------------------------------------------

  private drawLaneHeaderRow(
    lanesStartX: number, colW: number, lanes: number, headerH: number, scrollTop: number
  ): void {
    const rowY = scrollTop;

    // ── 背景（レーン1〜N列ぶん）──
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      String(lanesStartX));
    bg.setAttribute("y",      String(rowY));
    bg.setAttribute("width",  String(lanes * colW));
    bg.setAttribute("height", String(headerH));
    bg.setAttribute("fill",   "var(--background-primary-alt)");
    this.svg.appendChild(bg);

    // ── レーン番号(1〜lanes) ──
    for (let i = 0; i < lanes; i++) {
      const lane = LANE_MIN + i;
      const x    = lanesStartX + i * colW + colW / 2;

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x",                 String(x));
      text.setAttribute("y",                 String(rowY + headerH / 2));
      text.setAttribute("text-anchor",       "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("font-size",         "12");
      text.setAttribute("fill",              "var(--text-muted)");
      text.textContent = `レーン${lane}`;
      this.svg.appendChild(text);
    }

    // 下端の横境界線
    const bline = document.createElementNS(SVG_NS, "line");
    bline.setAttribute("x1", String(lanesStartX));
    bline.setAttribute("y1", String(rowY + headerH));
    bline.setAttribute("x2", String(lanesStartX + lanes * colW));
    bline.setAttribute("y2", String(rowY + headerH));
    bline.setAttribute("stroke",       "var(--background-modifier-border)");
    bline.setAttribute("stroke-width", "1");
    this.svg.appendChild(bline);
  }

  /**
   * 左上コーナー（年・月・GAP列の見出しを表示。
   * 上下左右どちらのスクロールにも追従して固定表示する）
   */
  private drawCornerHeader(
    scrollLeft: number, scrollTop: number, headerH: number, calendarName: string
  ): void {
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      String(scrollLeft));
    bg.setAttribute("y",      String(scrollTop));
    bg.setAttribute("width",  String(LANES_START_X));
    bg.setAttribute("height", String(headerH));
    bg.setAttribute("fill",   "var(--background-primary-alt)");
    this.svg.appendChild(bg);

    if (calendarName) {
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = calendarName;
      bg.appendChild(title);
    }

    const cells: Array<{ label: string; x: number; w: number }> = [
      { label: "年",   x: scrollLeft,                          w: YEAR_COL_W },
      { label: "月",   x: scrollLeft + YEAR_COL_W,              w: MONTH_COL_W },
      { label: "GAP",  x: scrollLeft + YEAR_COL_W + MONTH_COL_W, w: GAP_COL_W },
    ];

    for (const cell of cells) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x",                 String(cell.x + cell.w / 2));
      text.setAttribute("y",                 String(scrollTop + headerH / 2));
      text.setAttribute("text-anchor",       "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("font-size",         "10");
      text.setAttribute("font-weight",       "600");
      text.setAttribute("fill",              "var(--text-muted)");
      text.setAttribute("letter-spacing",    "0.5");
      text.textContent = cell.label;
      this.svg.appendChild(text);

      const divider = document.createElementNS(SVG_NS, "line");
      divider.setAttribute("x1", String(cell.x));
      divider.setAttribute("y1", String(scrollTop));
      divider.setAttribute("x2", String(cell.x));
      divider.setAttribute("y2", String(scrollTop + headerH));
      divider.setAttribute("stroke",       "var(--background-modifier-border)");
      divider.setAttribute("stroke-width", "0.6");
      this.svg.appendChild(divider);
    }

    // 下端・右端の境界線
    const bline = document.createElementNS(SVG_NS, "line");
    bline.setAttribute("x1", String(scrollLeft));
    bline.setAttribute("y1", String(scrollTop + headerH));
    bline.setAttribute("x2", String(scrollLeft + LANES_START_X));
    bline.setAttribute("y2", String(scrollTop + headerH));
    bline.setAttribute("stroke",       "var(--background-modifier-border)");
    bline.setAttribute("stroke-width", "1");
    this.svg.appendChild(bline);

    const rline = document.createElementNS(SVG_NS, "line");
    rline.setAttribute("x1", String(scrollLeft + LANES_START_X));
    rline.setAttribute("y1", String(scrollTop));
    rline.setAttribute("x2", String(scrollLeft + LANES_START_X));
    rline.setAttribute("y2", String(scrollTop + headerH));
    rline.setAttribute("stroke",       "var(--background-modifier-border)");
    rline.setAttribute("stroke-width", "1");
    this.svg.appendChild(rline);
  }

  // ----------------------------------------------------------
  // ノード描画（日にちバッジ）
  // ----------------------------------------------------------

  private drawNodes(
    ctx: RenderContext, visTop: number, visBottom: number, visLeft: number, visRight: number
  ): void {
    for (const node of ctx.nodes) {
      // ノードは真円になったため、当たり判定・カリング用の幅は
      // 外側リング（node.radius）の直径と一致する。
      const w = node.radius * 2;
      const h = node.radius * 2;
      // ノードは中心(node.x)がレーン列の中心。上端(node.y)が時間軸の起点で、
      // そこから下方向へh分だけ描画される。
      if (node.y + h < visTop || node.y > visBottom) continue;
      if (node.x + w / 2 < visLeft || node.x - w / 2 > visRight) continue;
      const isFiltered = ctx.filteredIds !== null && !ctx.filteredIds.has(node.event.id);
      const isSelected = node.event.id === ctx.selectedId;
      this.drawNode(node, isFiltered, isSelected, ctx);
    }
  }

  /** ノードに表示する日にちテキスト（例: "12日"） */
  private dayLabel(node: LayoutNode): string {
    return dayLabelForEvent(node.event);
  }

  private estimateFontSize(): number {
    return estimateNodeFontSize();
  }

  /** ノードの視覚上の中心Y座標（関係線・ホバー基準などに使用） */
  private nodeCenterY(node: LayoutNode): number {
    return node.y + node.radius;
  }

  /**
   * サイズ別のノード形状を生成する（同心円）。
   *   小 (small)  : 単円のみ                      → 一重丸
   *   中 (medium) : 「小」の円の下に、一回り大きい円
   *                 （不透明度75%）を重ねる         → 二重丸
   *   大 (big)    : さらにもう一回り大きい円
   *                 （不透明度50%）を一番下に重ねる  → 三重丸
   * サイズが大きくなるほど円の数が増えるだけでなく、内側に向かって
   * 不透明度が高くなることで、遠目にも大小を判別しやすくしている。
   *
   * @param cx      ノード中心のSVG X座標（レーン列の中心）
   * @param topY    ノード上端のSVG Y座標（時間軸上の日付起点）
   */
  private buildNodeShape(
    size: string, cx: number, topY: number, outerRadius: number,
    fill: string, isFiltered: boolean, isSelected: boolean
  ): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
    const cy = topY + outerRadius; // 上端 + 外側リング半径 = 円群全体の中心Y

    const rings = nodeRingsForSize(size);
    rings.forEach((ring, index) => {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(cx));
      circle.setAttribute("cy", String(cy));
      circle.setAttribute("r",  String(ring.r));
      circle.setAttribute("fill", fill);
      circle.setAttribute("fill-opacity", String(isFiltered ? ring.opacity * 0.25 : ring.opacity));
      // 選択中の強調枠は、一番外側のリング（＝サイズ全体の輪郭）にのみ付ける
      const isOutermost = index === 0;
      if (isOutermost && isSelected) {
        circle.setAttribute("stroke",       COLOR.nodeStroke);
        circle.setAttribute("stroke-width", "2.5");
      } else {
        circle.setAttribute("stroke",       "none");
        circle.setAttribute("stroke-width", "0");
      }
      g.appendChild(circle);
    });

    return g;
  }

  private drawNode(
    node: LayoutNode,
    isFiltered: boolean,
    isSelected: boolean,
    ctx: RenderContext
  ): void {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "ntj-node");
    g.setAttribute("data-event-id", node.event.id);
    // キーボード操作対応: 矢印キーによるロービングフォーカス方式のため、
    // Tabキーでは個々のノードへは止まらない（tabindex=-1）。
    // TimelineView側が矢印キー操作に応じて focus() を呼び出す。
    // Enter/Spaceでクリックと同じ動作（Popover表示）を行う点は変わらない。
    g.setAttribute("tabindex", "-1");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", node.event.displayTitle || node.event.date || "イベント");

    const text     = this.dayLabel(node);
    const fontSize = this.estimateFontSize();
    const h        = node.radius * 2;
    const w        = h; // 真円になったため、幅=高さ=外側リングの直径
    const centerY  = node.y + node.radius;
    const colors   = ctx.resolveNodeColors(node.event);

    // ノードの上端(node.y)が時間軸上の日付起点と一致するように描画する
    const shape = this.buildNodeShape(
      node.event.size, node.x, node.y, node.radius,
      isFiltered ? COLOR.nodeFiltered : colors.nodeColor,
      isFiltered, isSelected
    );
    g.appendChild(shape);

    if (!isFiltered) {
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("class",             "ntj-node-label");
      label.setAttribute("x",                 String(node.x));
      label.setAttribute("y",                 String(centerY));
      label.setAttribute("text-anchor",       "middle");
      label.setAttribute("dominant-baseline", "central");
      label.setAttribute("font-size",         String(fontSize));
      label.setAttribute("font-weight",       "600");
      label.setAttribute("fill",              colors.textColor || COLOR.nodeTextLight);
      // 日にちラベルは常に「小」の内接円（baseNodeRadius）に収める設計。
      // 文字幅の推定には誤差が出うる（全角「日」等と半角数字が混在するため）ので、
      // 推定幅が円からはみ出す場合のみ `textLength` で実際の描画幅を強制的にクランプする
      // 安全弁を設ける（GapRendererの日数ラベルと同様の手法）。
      const availableTextW = Math.max(6, baseNodeRadius() * 2 - NODE_LABEL_PADDING * 2);
      const estimatedTextWidth = text.length * fontSize * 0.62 + fontSize * 0.3;
      if (estimatedTextWidth > availableTextW) {
        label.setAttribute("textLength",  String(availableTextW.toFixed(1)));
        label.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
      label.textContent = text;
      g.appendChild(label);
    }

    if (node.event.error) {
      const warn = document.createElementNS(SVG_NS, "text");
      warn.setAttribute("x",                 String(node.x + w / 2 - 2));
      warn.setAttribute("y",                 String(node.y + 2));
      warn.setAttribute("font-size",         "10");
      warn.setAttribute("dominant-baseline", "auto");
      warn.setAttribute("fill",              COLOR.errorIcon);
      warn.textContent = "⚠";
      g.appendChild(warn);
    }

    g.addEventListener("mouseenter", (e: MouseEvent) => {
      this.tooltip.show(node.event, colors.nodeColor, e.clientX, e.clientY);
      ctx.onNodeHover(node.event, node, e.clientX, e.clientY);
    });
    g.addEventListener("mouseleave", () => {
      this.tooltip.hide();
      ctx.onNodeLeave();
    });
    g.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      this.tooltip.hide();
      ctx.onNodeClick(node.event, node, e.clientX, e.clientY);
    });
    g.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      e.stopPropagation();
      this.tooltip.hide();
      // キーボード操作にはマウス座標がないため、要素自身の中心座標をPopoverの
      // 表示位置として代用する
      const rect = (e.currentTarget as SVGGraphicsElement).getBoundingClientRect();
      ctx.onNodeClick(node.event, node, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    g.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.startDrag(e, node, g);
    });

    this.svg.appendChild(g);
  }

  // ----------------------------------------------------------
  // 関係線描画
  // ----------------------------------------------------------

  private drawRelations(
    ctx: RenderContext,
    visTop: number,
    visBottom: number
  ): void {
    const { edges, selectedId, settings } = ctx;
    const mode = settings.relationDisplayMode;
    if (mode === "hidden") return;

    for (const edge of edges) {
      if (mode === "selected") {
        if (edge.fromId !== selectedId && edge.toId !== selectedId) continue;
      }
      const fromInView = edge.fromNode.y >= visTop && edge.fromNode.y <= visBottom;
      const toInView   = edge.toNode.y   >= visTop && edge.toNode.y   <= visBottom;
      if (!fromInView && !toInView) continue;
      this.drawBezierEdge(edge, settings);
    }
  }

  private drawBezierEdge(edge: RelationEdge, settings: NovelsTimelineSettings): void {
    const { fromNode, toNode } = edge;
    const strength = settings.relationCurveStrength;
    // ノードの視覚上の中心（上端=時間軸起点なので、見た目の中心に接続する）
    const fromX = fromNode.x;
    const toX   = toNode.x;
    const fromY = this.nodeCenterY(fromNode);
    const toY   = this.nodeCenterY(toNode);
    // 時間軸が縦軸のため、曲線のふくらみはY方向の距離を基準にX方向へ持たせる
    const dy       = toY - fromY;
    const cpOffset = (strength / 100) * Math.max(40, Math.abs(dy) * 0.4);

    const d =
      `M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY + dy * 0.3}, ` +
      `${toX - cpOffset} ${toY - dy * 0.3}, ${toX} ${toY}`;

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d",            d);
    path.setAttribute("fill",         "none");
    path.setAttribute("stroke",       settings.relationColor);
    path.setAttribute("stroke-width", String(settings.relationWidth));
    path.setAttribute("stroke-opacity", String(settings.relationOpacity));

    if (settings.relationStyle === "dashed") path.setAttribute("stroke-dasharray", "6 4");
    else if (settings.relationStyle === "dotted") path.setAttribute("stroke-dasharray", "2 4");

    this.svg.appendChild(path);

    if (settings.relationArrowStyle !== "none") {
      this.drawMidArrow(path, settings);
    }
  }

  /**
   * SVGパスの50%地点の座標・接線方向を求め、矢印ポリゴンを配置する
   */
  private drawMidArrow(path: SVGPathElement, settings: NovelsTimelineSettings): void {
    let len: number;
    try {
      len = path.getTotalLength();
    } catch {
      return; // jsdom等で未実装の場合は無視
    }
    if (!len || len < 2) return;

    const mid  = path.getPointAtLength(len * 0.5);
    const next = path.getPointAtLength(len * 0.5 + 1);
    const angle = Math.atan2(next.y - mid.y, next.x - mid.x) * 180 / Math.PI;

    const style    = settings.relationArrowStyle;
    const color    = settings.relationColor;
    const opacity  = settings.relationOpacity;
    const sw       = settings.relationWidth;

    if (style === "triangle") {
      const size = 5 + sw;
      const tri  = document.createElementNS(SVG_NS, "polygon");
      tri.setAttribute("points",    `${size},0 ${-size * 0.6},${-size * 0.5} ${-size * 0.6},${size * 0.5}`);
      tri.setAttribute("fill",      color);
      tri.setAttribute("fill-opacity", String(opacity));
      tri.setAttribute("stroke",    "none");
      tri.setAttribute("transform", `translate(${mid.x},${mid.y}) rotate(${angle})`);
      this.svg.appendChild(tri);
    } else {
      const size = 5 + sw * 0.8;
      const arr  = document.createElementNS(SVG_NS, "path");
      arr.setAttribute("d",               `M${-size},${-size} L0,0 L${-size},${size}`);
      arr.setAttribute("fill",            "none");
      arr.setAttribute("stroke",          color);
      arr.setAttribute("stroke-width",    String(Math.max(1.2, sw * 0.8)));
      arr.setAttribute("stroke-opacity",  String(opacity));
      arr.setAttribute("stroke-linecap",  "round");
      arr.setAttribute("stroke-linejoin", "round");
      arr.setAttribute("transform",       `translate(${mid.x},${mid.y}) rotate(${angle})`);
      this.svg.appendChild(arr);
    }
  }

  // ----------------------------------------------------------
  // Gap 描画
  // ----------------------------------------------------------

  private drawGaps(
    ctx: RenderContext, visTop: number, visBottom: number,
    axisX: number, gapColW: number
  ): void {
    for (const gap of ctx.gaps) {
      if (gap.y < visTop || gap.y > visBottom) continue;

      // 表示スロット高さを算出する（Layoutでの配置高さと一致させ、
      // GAP同士が重ならないようにカード高さをこの範囲に収める）
      const gapDays    = Math.max(0, gap.toOrder - gap.fromOrder - 1);
      const slotHeight = gap.expanded
        ? Math.max(EXPANDED_MIN_HEIGHT, gapDays * EXPANDED_PX_PER_DAY)
        : GAP_SLOT_HEIGHT;

      const el = this.gapRenderer.render(gap, axisX, gapColW, slotHeight);
      el.setAttribute("data-gap-id", `${gap.fromOrder}:${gap.toOrder}`);
      // ノードと同様、Tabでは止まらずTimelineView側からfocus()される（ロービングフォーカス）
      el.setAttribute("tabindex", "-1");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${gap.label}（クリックで${gap.expanded ? "圧縮" : "展開"}）`);
      el.addEventListener("click", () => ctx.onGapClick(gap));
      el.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        e.preventDefault();
        ctx.onGapClick(gap);
      });
      this.svg.appendChild(el);
    }
  }

  // ----------------------------------------------------------
  // Drag & Drop（レーン変更のみ・横方向にドラッグする）
  // ----------------------------------------------------------

  private startDrag(e: MouseEvent, node: LayoutNode, g: SVGGElement): void {
    this.dragState = {
      active:       true,
      eventId:      node.event.id,
      startX:       e.clientX,
      circle:       g,
      originalLane: node.event.lane,
    };
    g.addClass("is-dragging");
  }

  private onDragMove(e: MouseEvent, _ctx: RenderContext): void {
    if (!this.dragState.active || !this.dragState.circle) return;
    const totalClientDx = e.clientX - this.dragState.startX;
    const totalSvgDx    = this.clientDxToSvgDx(totalClientDx);
    this.dragState.circle.setAttribute("transform", `translate(${totalSvgDx}, 0)`);
  }

  private onDragEnd(e: MouseEvent, ctx: RenderContext): void {
    if (!this.dragState.active) return;

    const totalClientDx = e.clientX - this.dragState.startX;
    const totalSvgDx    = this.clientDxToSvgDx(totalClientDx);

    const originX    = this.laneToSvgX(this.dragState.originalLane, this._lastLaneCount);
    const droppedX   = originX + totalSvgDx;
    const targetLane = this.svgXToLane(droppedX, this._lastLaneCount);

    ctx.onLaneDrop(this.dragState.eventId, targetLane);

    if (this.dragState.circle) {
      this.dragState.circle.removeClass("is-dragging");
      this.dragState.circle.removeAttribute("transform");
    }
    this.dragState.active = false;
  }

  /** lane番号(1〜laneCount) → SVG X座標（LayoutEngine.calcX と同じ式） */
  private laneToSvgX(lane: number, laneCount: number): number {
    const laneMax = Math.max(LANE_MIN, laneCount);
    const clamped = Math.max(LANE_MIN, Math.min(laneMax, lane));
    return LANES_START_X + (clamped - LANE_MIN) * LANE_COL_W + LANE_COL_W / 2;
  }

  /** SVG X座標 → 最近傍のlane番号（1〜laneCount） */
  svgXToLane(x: number, laneCount: number): number {
    const laneMax = Math.max(LANE_MIN, laneCount);
    let bestLane = LANE_MIN;
    let bestDist = Infinity;
    for (let lane = LANE_MIN; lane <= laneMax; lane++) {
      const lx   = this.laneToSvgX(lane, laneCount);
      const dist = Math.abs(x - lx);
      if (dist < bestDist) { bestDist = dist; bestLane = lane; }
    }
    return bestLane;
  }

  /** クライアントpx差分 → SVGユーザー座標差分（X方向） */
  private clientDxToSvgDx(clientDx: number): number {
    const ctm = this.svg.getScreenCTM();
    if (ctm && ctm.a !== 0) return clientDx / ctm.a;
    const rect   = this.svg.getBoundingClientRect();
    const totalW = parseFloat(this.svg.getAttribute("width") ?? "600");
    return clientDx * (totalW / (rect.width || totalW));
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  clientXToSvgX(clientX: number): number {
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      return (clientX - ctm.e) / ctm.a;
    }
    const rect = this.svg.getBoundingClientRect();
    const totalW = parseFloat(this.svg.getAttribute("width") ?? "1");
    return (clientX - rect.left + this.container.scrollLeft)
         * (totalW / (rect.width || 1));
  }

  /** クライアントY座標 → SVGユーザー座標（ボードズーム込み） */
  clientYToSvgY(clientY: number): number {
    const ctm = this.svg.getScreenCTM();
    if (ctm && ctm.d !== 0) {
      return (clientY - ctm.f) / ctm.d;
    }
    const rect = this.svg.getBoundingClientRect();
    const totalH = parseFloat(this.svg.getAttribute("height") ?? "1");
    return (clientY - rect.top + this.container.scrollTop)
         * (totalH / (rect.height || 1));
  }

  getSvgElement(): SVGSVGElement { return this.svg; }

  destroy(): void {
    this.tooltip.hide();
    this.tooltip.destroy();
    if (this.container.contains(this.svg)) this.container.removeChild(this.svg);
  }
}
