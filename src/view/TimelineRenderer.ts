// ============================================================
// TimelineRenderer.ts
// Novels Timeline JP — SVG 描画エンジン（横軸タイムライン版）
//
// v2 変更点:
//   ・時間軸を縦軸から横軸へ変更（X=時間, Y=レーン）
//   ・ノードは「●」ではなく「日にち」を表示するカプセル型バッジに変更
//   ・時間軸ルーラーは年・月のみを表示し、日は表示しない
//     （日はノード自体に表示されるため）
//   ・レーンは 1〜10 の固定行。左レーン／右レーンの概念とタイトル設定は廃止
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
import { LANE_MIN, LANE_MAX, LANE_COUNT, ROW_HEIGHT, HEADER_HEIGHT, GAP_ROW_HEIGHT, LANES_START_Y, LANE_LABEL_W, GAP_SLOT_WIDTH, EXPANDED_MIN_WIDTH, EXPANDED_PX_PER_DAY, dayLabelForEvent, estimateNodeFontSize, estimateNodePillWidth } from "../engine/LayoutEngine";

const SVG_NS = "http://www.w3.org/2000/svg";

const COLOR = {
  nodeStroke:      "var(--text-normal)",
  nodeFiltered:    "var(--background-modifier-border)",
  nodeTextLight:   "#ffffff",
  errorIcon:       "var(--text-error)",
  calendarHeader:  "var(--text-accent)",
} as const;

// ----------------------------------------------------------
// 時間軸ルーラーに描画する1列分の日付情報
// ----------------------------------------------------------

export interface DateRow {
  x:              number;   // SVG X座標（時間軸上の位置）
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
  totalWidth:    number;
  virtualWindow: VirtualWindow;
  dateRows:      DateRow[];
  onNodeClick:   (event: TimelineEvent, node: LayoutNode, mouseX: number, mouseY: number) => void;
  onNodeHover:   (event: TimelineEvent, node: LayoutNode, mouseX: number, mouseY: number) => void;
  onNodeLeave:   () => void;
  onGapClick:    (gap: GapSegment) => void;
  onContextMenu: (svgX: number, mouseX: number, mouseY: number, lane: number) => void;
  onLaneDrop:    (eventId: string, newLane: number) => void;
  /** イベントの color フィールド（配色セットIDまたは生HEX値）を実色に解決する */
  resolveNodeColors: (event: TimelineEvent) => { nodeColor: string; textColor: string };
}

/** render() 内部でのみ使用する、時間軸Y座標を加えた拡張コンテキスト */
interface InternalRenderContext extends RenderContext {
  axisY: number;
}

export class TimelineRenderer {
  private svg:         SVGSVGElement;
  private container:   HTMLElement;
  private tooltip:     Tooltip;
  private gapRenderer: GapRenderer;
  private _lastLanesStartY = LANES_START_Y; // render() で更新、drag時に参照

  private dragState: {
    active:   boolean;
    eventId:  string;
    startY:   number;
    circle:   SVGGElement | null;
    originalLane: number;
  } = { active: false, eventId: "", startY: 0, circle: null, originalLane: 1 };

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
    const { settings, totalWidth, virtualWindow } = ctx;

    const headerH    = HEADER_HEIGHT;
    const gapRowH    = GAP_ROW_HEIGHT;
    const lanesStartY = LANES_START_Y;
    const rowH       = ROW_HEIGHT;
    const lanes      = LANE_COUNT;
    const axisY      = headerH; // 時間軸（水平線）の位置
    const svgHeight  = lanesStartY + lanes * rowH + 24;
    this._lastLanesStartY = lanesStartY;

    this.svg.setAttribute("viewBox", `0 0 ${totalWidth} ${svgHeight}`);
    this.svg.setAttribute("width",   String(totalWidth));
    this.svg.setAttribute("height",  String(svgHeight));
    this.svg.style.minWidth = `${totalWidth}px`;

    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    const buffer    = settings.virtualRendering ? virtualWindow.buffer : Infinity;
    const visLeft   = virtualWindow.scrollLeft - buffer;
    const visRight  = virtualWindow.scrollLeft + virtualWindow.viewportWidth + buffer;

    const defs = document.createElementNS(SVG_NS, "defs");
    this.svg.appendChild(defs);

    const ctxWithAxis: InternalRenderContext = { ...ctx, axisY };

    // ① レーン行の背景（縞模様）と区切り線
    this.drawLaneRows(totalWidth, lanesStartY, rowH, lanes);
    // ② GAP専用レーンの背景（時間軸とイベントレーンの間）
    this.drawGapRowBackground(totalWidth, axisY, gapRowH);
    // ③ 時間軸（水平線）
    this.drawTimeAxis(axisY, totalWidth);
    // ④ Gap（GAP専用レーン内に表示）
    if (settings.gapCompression) {
      this.drawGaps(ctxWithAxis, visLeft, visRight, axisY, gapRowH);
    }
    // ⑤ 関係線（ノードより先に描画）
    this.drawRelations(ctxWithAxis, visLeft, visRight, defs);
    // ⑥ ノード（日にちバッジ）
    this.drawNodes(ctxWithAxis, visLeft, visRight);
    // ⑦ 日付ルーラー（年・月のみ・スクロール追従で上部固定）
    this.drawDateRuler(ctxWithAxis, visLeft, visRight);
    // ⑧ レーン番号ラベル（左側固定列・スクロール追従。GAP行も含む）
    this.drawLaneLabelColumn(axisY, gapRowH, rowH, lanes, virtualWindow.scrollLeft);
    // ⑨ 左上コーナー（暦名）
    this.drawCornerBox(virtualWindow.scrollLeft, virtualWindow.scrollTop, headerH);

    this.svg.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
      // clientXToSvgX() / clientYToSvgY() は getScreenCTM() 経由でボードズームを含む
      // 実際の描画スケールを考慮してSVGユーザー座標へ変換する。
      // （e.offsetX/e.offsetY はズーム時にスケールされた値になるため使用不可）
      const svgY = this.clientYToSvgY(e.clientY);
      const lane = this.svgYToLane(svgY, this._lastLanesStartY);
      ctx.onContextMenu(this.clientXToSvgX(e.clientX), e.clientX, e.clientY, lane);
    };
    this.svg.onmousemove = (e: MouseEvent) => {
      this.tooltip.move(e.clientX, e.clientY);
      this.onDragMove(e, ctxWithAxis);
    };
    this.svg.onmouseup = (e: MouseEvent) => this.onDragEnd(e, ctxWithAxis);
  }

  // ----------------------------------------------------------
  // GAP専用レーンの背景（時間軸とイベントレーンの間の帯）
  // ----------------------------------------------------------

  private drawGapRowBackground(totalWidth: number, axisY: number, gapRowH: number): void {
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      "0");
    bg.setAttribute("y",      String(axisY));
    bg.setAttribute("width",  String(totalWidth));
    bg.setAttribute("height", String(gapRowH));
    bg.setAttribute("fill",   "var(--background-secondary-alt)");
    bg.setAttribute("fill-opacity", "0.4");
    this.svg.appendChild(bg);

    const bottomLine = document.createElementNS(SVG_NS, "line");
    bottomLine.setAttribute("x1", "0");
    bottomLine.setAttribute("y1", String(axisY + gapRowH));
    bottomLine.setAttribute("x2", String(totalWidth));
    bottomLine.setAttribute("y2", String(axisY + gapRowH));
    bottomLine.setAttribute("stroke",       "var(--background-modifier-border)");
    bottomLine.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(bottomLine);
  }

  // ----------------------------------------------------------
  // レーン行の背景（縞模様）と区切り線
  // ----------------------------------------------------------

  private drawLaneRows(totalWidth: number, lanesStartY: number, rowH: number, lanes: number): void {
    for (let i = 0; i < lanes; i++) {
      const y = lanesStartY + i * rowH;

      if (i % 2 === 1) {
        const bg = document.createElementNS(SVG_NS, "rect");
        bg.setAttribute("x",      "0");
        bg.setAttribute("y",      String(y));
        bg.setAttribute("width",  String(totalWidth));
        bg.setAttribute("height", String(rowH));
        bg.setAttribute("fill",   "var(--background-secondary)");
        bg.setAttribute("fill-opacity", "0.5");
        this.svg.appendChild(bg);
      }

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(totalWidth));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke",       "var(--background-modifier-border)");
      line.setAttribute("stroke-width", "0.5");
      this.svg.appendChild(line);
    }
    // 最下段の境界線
    const bottomY = lanesStartY + lanes * rowH;
    const bottomLine = document.createElementNS(SVG_NS, "line");
    bottomLine.setAttribute("x1", "0");
    bottomLine.setAttribute("y1", String(bottomY));
    bottomLine.setAttribute("x2", String(totalWidth));
    bottomLine.setAttribute("y2", String(bottomY));
    bottomLine.setAttribute("stroke",       "var(--background-modifier-border)");
    bottomLine.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(bottomLine);
  }

  // ----------------------------------------------------------
  // 時間軸（水平線）— 帯背景 + 中央線
  // ----------------------------------------------------------

  private drawTimeAxis(axisY: number, totalWidth: number): void {
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
      grad.setAttribute("x2",  "0%");
      grad.setAttribute("y2",  "100%");
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
    band.setAttribute("x",      "0");
    band.setAttribute("y",      String(axisY - 8));
    band.setAttribute("width",  String(totalWidth));
    band.setAttribute("height", "16");
    band.setAttribute("fill",   `url(#${gradId})`);
    this.svg.appendChild(band);

    // 中央横線（メイン）
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",           "0");
    line.setAttribute("y1",           String(axisY));
    line.setAttribute("x2",           String(totalWidth));
    line.setAttribute("y2",           String(axisY));
    line.setAttribute("stroke",       "var(--interactive-accent)");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(line);
  }

  // ----------------------------------------------------------
  // 日付ルーラー（年・月のみ。スクロール追従で常に上部固定表示）
  // ----------------------------------------------------------

  private drawDateRuler(ctx: InternalRenderContext, visLeft: number, visRight: number): void {
    const { dateRows, virtualWindow, axisY } = ctx;
    if (dateRows.length === 0) return;

    const stickyY = virtualWindow.scrollTop; // 上部固定の基準Y

    let prevYear  = -1;
    let prevMonth = -1;

    for (const row of dateRows) {
      if (row.x < visLeft - 60 || row.x > visRight + 60) {
        prevYear  = row.year;
        prevMonth = row.month;
        continue;
      }

      if (row.year !== prevYear) {
        this.drawYearCard(row.year, row.x, stickyY, axisY);
        prevYear  = row.year;
        prevMonth = -1;
      }

      if (row.month !== prevMonth) {
        this.drawMonthBadge(row.monthLabel, row.x, stickyY);
        prevMonth = row.month;
      }
    }
  }

  /**
   * 年表示（枠なし）。
   * 区切り線は時間軸（axisY）までで終わり、GAPレーンやイベントレーンへは伸ばさない。
   * （月の区切り線と重なって実線のように見えてしまうのを防ぐため）
   */
  private drawYearCard(year: number, x: number, stickyY: number, axisY: number): void {
    const label = `${year}年`;
    const textY = stickyY + 14;

    // 区切り線（年の境界）— 年ラベルの位置から時間軸までのみ縦線でつなぐ
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",           String(x));
    line.setAttribute("y1",           String(stickyY + 4));
    line.setAttribute("x2",           String(x));
    line.setAttribute("y2",           String(axisY));
    line.setAttribute("stroke",       "var(--text-muted)");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", "0.4");
    this.svg.appendChild(line);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(x + 5));
    text.setAttribute("y",                 String(textY));
    text.setAttribute("text-anchor",       "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "12");
    text.setAttribute("font-weight",       "700");
    text.setAttribute("fill",              "var(--text-normal)");
    text.textContent = label;
    this.svg.appendChild(text);
  }

  /** 月表示（枠なし・時間軸へ縦線でつなぐ） */
  private drawMonthBadge(monthLabel: string, x: number, stickyY: number): void {
    const textY = stickyY + 34;

    // 区切り線（月の境界）— 月ラベルの位置から時間軸（および下方）まで縦線でつなぐ
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",               String(x));
    line.setAttribute("y1",               String(stickyY + 24));
    line.setAttribute("x2",               String(x));
    line.setAttribute("y2",               "9999");
    line.setAttribute("stroke",           "var(--text-muted)");
    line.setAttribute("stroke-width",     "0.6");
    line.setAttribute("stroke-opacity",   "0.25");
    line.setAttribute("stroke-dasharray", "3 4");
    this.svg.appendChild(line);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(x + 5));
    text.setAttribute("y",                 String(textY));
    text.setAttribute("text-anchor",       "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "10");
    text.setAttribute("font-weight",       "500");
    text.setAttribute("fill",              "var(--text-muted)");
    text.textContent = monthLabel;
    this.svg.appendChild(text);
  }

  // ----------------------------------------------------------
  // レーン番号ラベル（左側固定列。スクロール追従で常に左端固定表示）
  // ----------------------------------------------------------

  private drawLaneLabelColumn(
    axisY: number, gapRowH: number, rowH: number, lanes: number, scrollLeft: number
  ): void {
    const colX        = scrollLeft;
    const lanesStartY = axisY + gapRowH;

    // ── 背景（GAP行 + レーン1〜10行）──
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      String(colX));
    bg.setAttribute("y",      String(axisY));
    bg.setAttribute("width",  String(LANE_LABEL_W));
    bg.setAttribute("height", String(gapRowH + lanes * rowH));
    bg.setAttribute("fill",   "var(--background-primary-alt)");
    this.svg.appendChild(bg);

    // ── GAP専用レーンのラベル ──
    const gapLabelY = axisY + gapRowH / 2;
    const gapText = document.createElementNS(SVG_NS, "text");
    gapText.setAttribute("x",                 String(colX + LANE_LABEL_W / 2));
    gapText.setAttribute("y",                 String(gapLabelY));
    gapText.setAttribute("text-anchor",       "middle");
    gapText.setAttribute("dominant-baseline", "central");
    gapText.setAttribute("font-size",         "10");
    gapText.setAttribute("font-weight",       "600");
    gapText.setAttribute("fill",              "var(--text-muted)");
    gapText.setAttribute("letter-spacing",    "0.5");
    gapText.textContent = "GAP";
    this.svg.appendChild(gapText);

    // GAP行とレーン1の間の境界線
    const gapDivider = document.createElementNS(SVG_NS, "line");
    gapDivider.setAttribute("x1", String(colX));
    gapDivider.setAttribute("y1", String(lanesStartY));
    gapDivider.setAttribute("x2", String(colX + LANE_LABEL_W));
    gapDivider.setAttribute("y2", String(lanesStartY));
    gapDivider.setAttribute("stroke",       "var(--background-modifier-border)");
    gapDivider.setAttribute("stroke-width", "1");
    this.svg.appendChild(gapDivider);

    // ── レーン番号(1〜10) ──
    for (let i = 0; i < lanes; i++) {
      const lane = LANE_MIN + i;
      const y    = lanesStartY + i * rowH + rowH / 2;

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x",                 String(colX + LANE_LABEL_W / 2));
      text.setAttribute("y",                 String(y));
      text.setAttribute("text-anchor",       "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("font-size",         "13");
      text.setAttribute("fill",              "var(--text-muted)");
      text.textContent = String(lane);
      this.svg.appendChild(text);
    }

    // 右端の縦境界線
    const rline = document.createElementNS(SVG_NS, "line");
    rline.setAttribute("x1", String(colX + LANE_LABEL_W));
    rline.setAttribute("y1", String(axisY));
    rline.setAttribute("x2", String(colX + LANE_LABEL_W));
    rline.setAttribute("y2", String(lanesStartY + lanes * rowH));
    rline.setAttribute("stroke",       "var(--background-modifier-border)");
    rline.setAttribute("stroke-width", "1");
    this.svg.appendChild(rline);
  }

  /** 左上コーナー（暦名を表示。上下左右どちらのスクロールにも追従して固定表示） */
  private drawCornerBox(scrollLeft: number, scrollTop: number, headerH: number): void {
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      String(scrollLeft));
    bg.setAttribute("y",      String(scrollTop));
    bg.setAttribute("width",  String(LANE_LABEL_W));
    bg.setAttribute("height", String(headerH));
    bg.setAttribute("fill",   "var(--background-primary-alt)");
    this.svg.appendChild(bg);

    const border = document.createElementNS(SVG_NS, "line");
    border.setAttribute("x1", String(scrollLeft));
    border.setAttribute("y1", String(scrollTop + headerH));
    border.setAttribute("x2", String(scrollLeft + LANE_LABEL_W));
    border.setAttribute("y2", String(scrollTop + headerH));
    border.setAttribute("stroke",       "var(--background-modifier-border)");
    border.setAttribute("stroke-width", "1");
    this.svg.appendChild(border);
  }

  // ----------------------------------------------------------
  // ノード描画（日にちバッジ）
  // ----------------------------------------------------------

  private drawNodes(ctx: RenderContext, visLeft: number, visRight: number): void {
    for (const node of ctx.nodes) {
      const w = this.estimatePillWidth(node);
      // ノードは左端(node.x)が時間軸の起点。右方向へwidth分だけ描画される。
      if (node.x + w < visLeft || node.x > visRight) continue;
      const isFiltered = ctx.filteredIds !== null && !ctx.filteredIds.has(node.event.id);
      const isSelected = node.event.id === ctx.selectedId;
      this.drawNode(node, isFiltered, isSelected, ctx);
    }
  }

  /** ノードに表示する日にちテキスト（例: "12日"） */
  private dayLabel(node: LayoutNode): string {
    return dayLabelForEvent(node.event);
  }

  private estimateFontSize(node: LayoutNode): number {
    return estimateNodeFontSize(node.radius);
  }

  private estimatePillWidth(node: LayoutNode): number {
    return estimateNodePillWidth(node.event, node.radius);
  }

  /** ノードの視覚上の中心X座標（関係線・ホバー基準などに使用） */
  private nodeCenterX(node: LayoutNode): number {
    return node.x + this.estimatePillWidth(node) / 2;
  }

  /**
   * サイズ別のノード形状を生成する。
   *   小 (small)  : 長方形
   *   中 (medium) : 楕円形
   *   大 (big)    : 横長の六角形
   *
   * @param x       ノード左端のSVG X座標（時間軸上の日付起点）
   * @param y       ノード中心のSVG Y座標
   * @param w       ノード全体の幅(px)
   * @param h       ノード全体の高さ(px)
   */
  private buildNodeShape(
    size: string, x: number, y: number, w: number, h: number,
    fill: string, fillOpacity: string, stroke: string, strokeWidth: string
  ): SVGElement {
    const halfH = h / 2;

    if (size === "small") {
      // 長方形
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x",      String(x));
      rect.setAttribute("y",      String(y - halfH));
      rect.setAttribute("width",  String(w));
      rect.setAttribute("height", String(h));
      rect.setAttribute("rx",     "1.5");
      this.applyShapeStyle(rect, fill, fillOpacity, stroke, strokeWidth);
      return rect;
    }

    if (size === "big") {
      // 横長の六角形
      const notch = Math.min(halfH * 0.7, w / 3);
      const points = [
        `${x + notch},${y - halfH}`,
        `${x + w - notch},${y - halfH}`,
        `${x + w},${y}`,
        `${x + w - notch},${y + halfH}`,
        `${x + notch},${y + halfH}`,
        `${x},${y}`,
      ].join(" ");
      const hex = document.createElementNS(SVG_NS, "polygon");
      hex.setAttribute("points", points);
      this.applyShapeStyle(hex, fill, fillOpacity, stroke, strokeWidth);
      return hex;
    }

    // medium: 楕円形
    const ellipse = document.createElementNS(SVG_NS, "ellipse");
    ellipse.setAttribute("cx", String(x + w / 2));
    ellipse.setAttribute("cy", String(y));
    ellipse.setAttribute("rx", String(w / 2));
    ellipse.setAttribute("ry", String(halfH));
    this.applyShapeStyle(ellipse, fill, fillOpacity, stroke, strokeWidth);
    return ellipse;
  }

  private applyShapeStyle(
    el: SVGElement, fill: string, fillOpacity: string, stroke: string, strokeWidth: string
  ): void {
    el.setAttribute("fill",         fill);
    el.setAttribute("fill-opacity", fillOpacity);
    el.setAttribute("stroke",       stroke);
    el.setAttribute("stroke-width", strokeWidth);
  }

  private drawNode(
    node: LayoutNode,
    isFiltered: boolean,
    isSelected: boolean,
    ctx: RenderContext
  ): void {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "ntj-node");
    g.style.cursor = "grab";

    const text     = this.dayLabel(node);
    const fontSize = this.estimateFontSize(node);
    const halfH    = node.radius;
    const w        = this.estimatePillWidth(node);
    const h        = halfH * 2;
    const centerX  = node.x + w / 2;
    const colors   = ctx.resolveNodeColors(node.event);

    // ノードの左端(node.x)が時間軸上の日付起点と一致するように描画する
    const shape = this.buildNodeShape(
      node.event.size, node.x, node.y, w, h,
      isFiltered ? COLOR.nodeFiltered : colors.nodeColor,
      isFiltered ? "0.25" : "1",
      isSelected ? COLOR.nodeStroke : "none",
      isSelected ? "2.5" : "0"
    );
    g.appendChild(shape);

    if (!isFiltered) {
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x",                 String(centerX));
      label.setAttribute("y",                 String(node.y));
      label.setAttribute("text-anchor",       "middle");
      label.setAttribute("dominant-baseline", "central");
      label.setAttribute("font-size",         String(fontSize));
      label.setAttribute("font-weight",       "600");
      label.setAttribute("fill",              colors.textColor || COLOR.nodeTextLight);
      label.style.pointerEvents = "none";
      label.textContent = text;
      g.appendChild(label);
    }

    if (node.event.error) {
      const warn = document.createElementNS(SVG_NS, "text");
      warn.setAttribute("x",                 String(node.x + w - 2));
      warn.setAttribute("y",                 String(node.y - halfH + 2));
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
    visLeft: number,
    visRight: number,
    _defs: SVGDefsElement
  ): void {
    const { edges, selectedId, settings } = ctx;
    const mode = settings.relationDisplayMode;
    if (mode === "hidden") return;

    for (const edge of edges) {
      if (mode === "selected") {
        if (edge.fromId !== selectedId && edge.toId !== selectedId) continue;
      }
      const fromInView = edge.fromNode.x >= visLeft && edge.fromNode.x <= visRight;
      const toInView   = edge.toNode.x   >= visLeft && edge.toNode.x   <= visRight;
      if (!fromInView && !toInView) continue;
      this.drawBezierEdge(edge, settings);
    }
  }

  private drawBezierEdge(edge: RelationEdge, settings: NovelsTimelineSettings): void {
    const { fromNode, toNode } = edge;
    const strength = settings.relationCurveStrength;
    // ノードの視覚上の中心（左端=時間軸起点なので、見た目の中心に接続する）
    const fromX = this.nodeCenterX(fromNode);
    const toX   = this.nodeCenterX(toNode);
    // 時間軸が横軸のため、曲線のふくらみはX方向の距離を基準にY方向へ持たせる
    const dx       = toX - fromX;
    const cpOffset = (strength / 100) * Math.max(40, Math.abs(dx) * 0.4);

    const d =
      `M ${fromX} ${fromNode.y} C ${fromX + dx * 0.3} ${fromNode.y + cpOffset}, ` +
      `${toX - dx * 0.3} ${toNode.y - cpOffset}, ${toX} ${toNode.y}`;

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
    ctx: InternalRenderContext, visLeft: number, visRight: number,
    axisY: number, gapRowH: number
  ): void {
    for (const gap of ctx.gaps) {
      if (gap.y < visLeft || gap.y > visRight) continue;

      // 表示スロット幅を算出する（Layoutでの配置幅と一致させ、
      // GAP同士が重ならないようにカード幅をこの範囲に収める）
      const gapDays   = Math.max(0, gap.toOrder - gap.fromOrder - 1);
      const slotWidth = gap.expanded
        ? Math.max(EXPANDED_MIN_WIDTH, gapDays * EXPANDED_PX_PER_DAY)
        : GAP_SLOT_WIDTH;

      const el = this.gapRenderer.render(gap, axisY, gapRowH, slotWidth);
      el.addEventListener("click", () => ctx.onGapClick(gap));
      this.svg.appendChild(el);
    }
  }

  // ----------------------------------------------------------
  // Drag & Drop（レーン変更のみ・縦方向にドラッグする）
  // ----------------------------------------------------------

  private startDrag(e: MouseEvent, node: LayoutNode, g: SVGGElement): void {
    this.dragState = {
      active:       true,
      eventId:      node.event.id,
      startY:       e.clientY,
      circle:       g,
      originalLane: node.event.lane,
    };
    g.style.cursor = "grabbing";
  }

  private onDragMove(e: MouseEvent, _ctx: RenderContext): void {
    if (!this.dragState.active || !this.dragState.circle) return;
    const totalClientDy = e.clientY - this.dragState.startY;
    const totalSvgDy    = this.clientDyToSvgDy(totalClientDy);
    const originY  = this.laneToSvgY(this.dragState.originalLane, this._lastLanesStartY);
    this.dragState.circle.setAttribute("transform", `translate(0, ${totalSvgDy})`);
    void originY;
  }

  private onDragEnd(e: MouseEvent, ctx: RenderContext): void {
    if (!this.dragState.active) return;

    const totalClientDy = e.clientY - this.dragState.startY;
    const totalSvgDy    = this.clientDyToSvgDy(totalClientDy);

    const originY    = this.laneToSvgY(this.dragState.originalLane, this._lastLanesStartY);
    const droppedY   = originY + totalSvgDy;
    const targetLane = this.svgYToLane(droppedY, this._lastLanesStartY);

    ctx.onLaneDrop(this.dragState.eventId, targetLane);

    if (this.dragState.circle) {
      this.dragState.circle.style.cursor = "grab";
      this.dragState.circle.removeAttribute("transform");
    }
    this.dragState.active = false;
  }

  /** lane番号(1〜10) → SVG Y座標（LayoutEngine.calcY と同じ式） */
  private laneToSvgY(lane: number, headerH: number): number {
    const clamped = Math.max(LANE_MIN, Math.min(LANE_MAX, lane));
    return headerH + (clamped - LANE_MIN) * ROW_HEIGHT + ROW_HEIGHT / 2;
  }

  /** SVG Y座標 → 最近傍のlane番号（1〜10） */
  svgYToLane(y: number, headerH: number): number {
    let bestLane = LANE_MIN;
    let bestDist = Infinity;
    for (let lane = LANE_MIN; lane <= LANE_MAX; lane++) {
      const ly   = this.laneToSvgY(lane, headerH);
      const dist = Math.abs(y - ly);
      if (dist < bestDist) { bestDist = dist; bestLane = lane; }
    }
    return bestLane;
  }

  /** クライアントpx差分 → SVGユーザー座標差分（Y方向） */
  private clientDyToSvgDy(clientDy: number): number {
    const ctm = this.svg.getScreenCTM();
    if (ctm && ctm.d !== 0) return clientDy / ctm.d;
    const rect    = this.svg.getBoundingClientRect();
    const totalH  = parseFloat(this.svg.getAttribute("height") ?? "600");
    return clientDy * (totalH / (rect.height || totalH));
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
