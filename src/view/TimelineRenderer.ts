// ============================================================
// TimelineRenderer.ts
// Novels Timeline JP — SVG 描画エンジン（完全版）
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

const SVG_NS = "http://www.w3.org/2000/svg";

const COLOR = {
  timeAxis:        "var(--background-modifier-border)",
  timeAxisMonth:   "var(--text-faint)",
  nodeStroke:      "var(--text-normal)",
  nodeFiltered:    "var(--background-modifier-border)",
  relation:        "var(--text-muted)",
  errorIcon:       "var(--text-error)",
  dateLabel:       "var(--text-faint)",
  dateLabelDay:    "var(--text-muted)",
  dateLabelMonth:  "var(--text-normal)",
  dateLabelBg:     "var(--background-secondary)",
  calendarHeader:  "var(--text-accent)",
} as const;

// ----------------------------------------------------------
// 時間軸に描画する1行分の日付情報
// ----------------------------------------------------------

export interface DateRow {
  y:              number;   // SVG Y座標
  day:            number;   // 日（例: 3）
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
  centerX:       number;
  totalHeight:   number;
  virtualWindow: VirtualWindow;
  dateRows:      DateRow[];
  onNodeClick:   (event: TimelineEvent, node: LayoutNode, mouseX: number, mouseY: number) => void;
  onNodeHover:   (event: TimelineEvent, node: LayoutNode, mouseX: number, mouseY: number) => void;
  onNodeLeave:   () => void;
  onGapClick:    (gap: GapSegment) => void;
  onContextMenu: (svgY: number, mouseX: number, mouseY: number) => void;
  onLaneDrop:    (eventId: string, newLane: number) => void;
}

export class TimelineRenderer {
  private svg:         SVGSVGElement;
  private container:   HTMLElement;
  private tooltip:     Tooltip;
  private gapRenderer: GapRenderer;

  private dragState: {
    active:   boolean;
    eventId:  string;
    startX:   number;
    currentX: number;
    laneWidth: number;
    circle:   SVGCircleElement | null;
  } = { active: false, eventId: "", startX: 0, currentX: 0, laneWidth: 40, circle: null };

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
    const { settings, totalHeight, virtualWindow } = ctx;

    // ─── レイアウト定数 ───
    // イベントレーン幅
    const LANE_W  = 40;
    // 時間軸セル幅（イベントレーンの2倍）
    const AXIS_W  = LANE_W * 2;
    // レーン数（片側）
    const LANES   = 10;
    // SVG幅 = 左10レーン + 時間軸セル + 右10レーン
    const svgWidth = LANE_W * LANES + AXIS_W + LANE_W * LANES;
    // centerX = 時間軸セルの中央
    const centerX  = LANE_W * LANES + AXIS_W / 2;

    this.svg.setAttribute("viewBox", `0 0 ${svgWidth} ${totalHeight}`);
    this.svg.setAttribute("width",   String(svgWidth));
    this.svg.setAttribute("height",  String(totalHeight));
    this.svg.style.minWidth = `${svgWidth}px`;

    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    const buffer    = settings.virtualRendering ? virtualWindow.buffer : Infinity;
    const visTop    = virtualWindow.scrollTop - buffer;
    const visBottom = virtualWindow.scrollTop + virtualWindow.viewportHeight + buffer;

    const defs = document.createElementNS(SVG_NS, "defs");
    this.svg.appendChild(defs);

    // centerX を ctx に上書きして渡す
    const ctxWithCenter = { ...ctx, centerX };

    this.drawRuler(centerX, svgWidth, LANE_W, AXIS_W, LANES, virtualWindow.scrollTop);
    this.drawTimeAxis(centerX, totalHeight);
    // Gap は日付ラベルより下のレイヤー（日付ラベルに隠れないよう先に描画）
    if (settings.gapCompression) {
      this.drawGaps(ctxWithCenter, visTop, visBottom);
    }
    this.drawDateLabels(ctxWithCenter, visTop, visBottom);
    // ノードを先に描画し、関係線の矢印がノードの上に来るようにする
    this.drawNodes(ctxWithCenter, visTop, visBottom);
    this.drawRelations(ctxWithCenter, visTop, visBottom, defs);

    this.svg.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
      // SVGユーザー座標への正しい変換:
      //   offsetY = SVG要素のCSSレイアウト上の上端からのY（0〜rect.height）
      //   scaleY  = SVGユーザー高さ(height属性値) / CSSレイアウト高さ(rect.height)
      //             SVGがコンテナにクリップされている場合は totalHeight/containerHeight
      //             SVGが全高表示の場合は 1.0
      //   SVGユーザーY = scrollTop + offsetY * scaleY
      const rect   = this.svg.getBoundingClientRect();
      const totalH = parseFloat(this.svg.getAttribute("height") ?? "1");
      const scaleY = totalH / (rect.height || 1);
      const svgY   = this.container.scrollTop + e.offsetY * scaleY;
      ctx.onContextMenu(svgY, e.clientX, e.clientY);
    };
    this.svg.onmousemove = (e: MouseEvent) => {
      this.tooltip.move(e.clientX, e.clientY);
      this.onDragMove(e, ctxWithCenter);
    };
    this.svg.onmouseup = (e: MouseEvent) => this.onDragEnd(e, ctxWithCenter);
  }

  // ----------------------------------------------------------
  // レーンルーラー（タイムライン上部のレーン番号表示）
  // スクロールに追従して常に上部に固定表示する
  // ----------------------------------------------------------

  private drawRuler(
    centerX: number,
    svgWidth: number,
    laneW: number,
    axisW: number,    // 時間軸セル幅（laneW*2）
    lanes: number,
    scrollTop: number
  ): void {
    const rulerH = 28;
    const rulerY = scrollTop;

    // ルーラー背景
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x",      "0");
    bg.setAttribute("y",      String(rulerY));
    bg.setAttribute("width",  String(svgWidth));
    bg.setAttribute("height", String(rulerH));
    bg.setAttribute("fill",   "var(--background-secondary)");
    this.svg.appendChild(bg);

    // 時間軸セルの左端X（= centerX - axisW/2）
    const axisLeft = centerX - axisW / 2;

    // ─── 左レーン（-lanes 〜 -1）───
    for (let lane = -lanes; lane <= -1; lane++) {
      // lane=-1のノード位置: centerX + (-1)*laneW
      // そのノードを含むセルの左端: centerX + lane*laneW
      // ただし時間軸セルの左に詰めるので:
      const cellLeft = axisLeft + lane * laneW;  // lane=-1→axisLeft-40, -2→axisLeft-80...
      const cellCenterX = cellLeft + laneW / 2;

      this.drawRulerCell(cellLeft, rulerY, laneW, rulerH, String(lane),
        "var(--text-normal)");
    }

    // ─── 時間軸セル（lane=0, 幅2倍）───
    this.drawRulerCell(axisLeft, rulerY, axisW, rulerH, "｜",
      "var(--text-muted)", true);

    // ─── 右レーン（1 〜 lanes）───
    for (let lane = 1; lane <= lanes; lane++) {
      const cellLeft = axisLeft + axisW + (lane - 1) * laneW;
      this.drawRulerCell(cellLeft, rulerY, laneW, rulerH, String(lane),
        "var(--text-accent)");
    }

    // 右端の縦線
    const rightX = axisLeft + axisW + lanes * laneW;
    const rline = document.createElementNS(SVG_NS, "line");
    rline.setAttribute("x1", String(rightX));
    rline.setAttribute("y1", String(rulerY));
    rline.setAttribute("x2", String(rightX));
    rline.setAttribute("y2", String(rulerY + rulerH));
    rline.setAttribute("stroke",       "var(--background-modifier-border)");
    rline.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(rline);

    // 下境界線
    const border = document.createElementNS(SVG_NS, "line");
    border.setAttribute("x1", "0");
    border.setAttribute("y1", String(rulerY + rulerH));
    border.setAttribute("x2", String(svgWidth));
    border.setAttribute("y2", String(rulerY + rulerH));
    border.setAttribute("stroke",       "var(--background-modifier-border)");
    border.setAttribute("stroke-width", "1");
    this.svg.appendChild(border);
  }

  /** ルーラーの1セル（左端縦線＋ラベルテキスト）を描画 */
  private drawRulerCell(
    cellLeft: number, rulerY: number,
    cellW: number, rulerH: number,
    label: string, color: string,
    isAxis = false
  ): void {
    // 左端縦線
    const vline = document.createElementNS(SVG_NS, "line");
    vline.setAttribute("x1", String(cellLeft));
    vline.setAttribute("y1", String(rulerY));
    vline.setAttribute("x2", String(cellLeft));
    vline.setAttribute("y2", String(rulerY + rulerH));
    vline.setAttribute("stroke",       "var(--background-modifier-border)");
    vline.setAttribute("stroke-width", isAxis ? "1" : "0.5");
    this.svg.appendChild(vline);

    // ラベル（セル中央）
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(cellLeft + cellW / 2));
    text.setAttribute("y",                 String(rulerY + rulerH / 2));
    text.setAttribute("text-anchor",       "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         isAxis ? "13" : "10");
    text.setAttribute("fill",              color);
    text.textContent = label;
    this.svg.appendChild(text);
  }

  // ----------------------------------------------------------
  // 時間軸（中央縦線 + 帯背景）ニューモーフィズムスタイル
  // ----------------------------------------------------------

  private drawTimeAxis(centerX: number, totalHeight: number): void {
    const AXIS_W = 80; // 時間軸セル幅（Rendererの計算と一致）

    // defs にグラデーションを定義
    let defs = this.svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVG_NS, "defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    // 帯背景グラデーション（中央が微妙に明るい）
    const gradId = "ntj-axis-grad";
    if (!defs.querySelector(`#${gradId}`)) {
      const grad = document.createElementNS(SVG_NS, "linearGradient");
      grad.setAttribute("id",  gradId);
      grad.setAttribute("x1",  "0%");
      grad.setAttribute("y1",  "0%");
      grad.setAttribute("x2",  "100%");
      grad.setAttribute("y2",  "0%");
      for (const [offset, opacity] of [["0%","0"],["20%","0.06"],["50%","0.12"],["80%","0.06"],["100%","0"]]) {
        const stop = document.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset",      offset);
        stop.setAttribute("stop-color",  "var(--interactive-accent)");
        stop.setAttribute("stop-opacity", opacity);
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
    }

    // 帯背景（時間軸セル幅分）
    const band = document.createElementNS(SVG_NS, "rect");
    band.setAttribute("x",      String(centerX - AXIS_W / 2));
    band.setAttribute("y",      "0");
    band.setAttribute("width",  String(AXIS_W));
    band.setAttribute("height", String(totalHeight));
    band.setAttribute("fill",   `url(#${gradId})`);
    this.svg.appendChild(band);

    // 中央縦線（メイン）
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",           String(centerX));
    line.setAttribute("y1",           "0");
    line.setAttribute("x2",           String(centerX));
    line.setAttribute("y2",           String(totalHeight));
    line.setAttribute("stroke",       "var(--interactive-accent)");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-opacity", "0.4");
    this.svg.appendChild(line);
  }

  // ----------------------------------------------------------
  // 日付ラベル描画（ニューモーフィズムスタイル）
  // ----------------------------------------------------------

  private drawDateLabels(ctx: RenderContext, visTop: number, visBottom: number): void {
    const { dateRows, centerX } = ctx;
    if (dateRows.length === 0) return;

    // ① 暦名ヘッダー（最上部固定）
    const firstRow = dateRows[0];
    if (firstRow.calendarPrefix) {
      this.drawCalendarHeader(firstRow.calendarPrefix, centerX);
    }

    let prevYear  = -1;
    let prevMonth = -1;

    for (const row of dateRows) {
      if (row.y < visTop - 30 || row.y > visBottom + 30) {
        prevYear  = row.year;
        prevMonth = row.month;
        continue;
      }

      // ② 年が変わった → 年カード
      if (row.year !== prevYear) {
        this.drawYearCard(row.year, row.y, centerX);
        prevYear  = row.year;
        prevMonth = -1;
      }

      // ③ 月が変わった → 月バッジ
      if (row.month !== prevMonth) {
        this.drawMonthBadge(row.monthLabel, row.y, centerX);
        prevMonth = row.month;
      }

      // ④ 日ドット＋日ラベル
      this.drawDayDot(row.day, row.y, centerX);
    }
  }

  /** ① 暦名ヘッダー */
  private drawCalendarHeader(prefix: string, centerX: number): void {
    const y  = 45; // 55から10px上に移動
    const tw = prefix.length * 8 + 20;
    const th = 22;

    // カード背景（ニューモーフィズム浮き上がり）
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x",       String(centerX - tw / 2 + 2));
    shadow.setAttribute("y",       String(y - th / 2 + 2));
    shadow.setAttribute("width",   String(tw));
    shadow.setAttribute("height",  String(th));
    shadow.setAttribute("rx",      "6");
    shadow.setAttribute("fill",    "rgba(0,0,0,0.18)");
    this.svg.appendChild(shadow);

    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x",       String(centerX - tw / 2));
    card.setAttribute("y",       String(y - th / 2));
    card.setAttribute("width",   String(tw));
    card.setAttribute("height",  String(th));
    card.setAttribute("rx",      "6");
    card.setAttribute("fill",    "var(--background-secondary)");
    card.setAttribute("stroke",  "var(--interactive-accent)");
    card.setAttribute("stroke-width", "1");
    card.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(card);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(centerX));
    text.setAttribute("y",                 String(y));
    text.setAttribute("text-anchor",       "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "12");
    text.setAttribute("font-weight",       "700");
    text.setAttribute("fill",              "var(--interactive-accent)");
    text.textContent = prefix;
    this.svg.appendChild(text);
  }

  /** ② 年カード（ニューモーフィズム浮き上がりカード） */
  private drawYearCard(year: number, y: number, centerX: number): void {
    const label = `${year}`;
    const tw    = label.length * 9 + 20;
    const th    = 18;
    const cardY = y - 38; // ノードの38px上（月バッジと重ならないよう十分離す）

    // 全幅の薄い区切り線（年の境界）
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1",               "0");
    line.setAttribute("y1",               String(y - 50));
    line.setAttribute("x2",               "9999");
    line.setAttribute("y2",               String(y - 50));
    line.setAttribute("stroke",           "var(--interactive-accent)");
    line.setAttribute("stroke-width",     "0.5");
    line.setAttribute("stroke-opacity",   "0.3");
    line.setAttribute("stroke-dasharray", "4 6");
    this.svg.appendChild(line);

    // ドロップシャドウ
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x",      String(centerX - tw / 2 + 2));
    shadow.setAttribute("y",      String(cardY - th / 2 + 2));
    shadow.setAttribute("width",  String(tw));
    shadow.setAttribute("height", String(th));
    shadow.setAttribute("rx",     "5");
    shadow.setAttribute("fill",   "rgba(0,0,0,0.2)");
    this.svg.appendChild(shadow);

    // カード本体
    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x",       String(centerX - tw / 2));
    card.setAttribute("y",       String(cardY - th / 2));
    card.setAttribute("width",   String(tw));
    card.setAttribute("height",  String(th));
    card.setAttribute("rx",      "5");
    card.setAttribute("fill",    "var(--background-secondary)");
    card.setAttribute("stroke",  "var(--background-modifier-border)");
    card.setAttribute("stroke-width", "0.8");
    this.svg.appendChild(card);

    // テキスト
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(centerX));
    text.setAttribute("y",                 String(cardY));
    text.setAttribute("text-anchor",       "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "10");
    text.setAttribute("font-weight",       "700");
    text.setAttribute("fill",              "var(--text-normal)");
    text.textContent = label;
    this.svg.appendChild(text);
  }

  /** ③ 月バッジ（ピル型） */
  private drawMonthBadge(monthLabel: string, y: number, centerX: number): void {
    const tw  = monthLabel.length * 7 + 14;
    const th  = 14;
    // 年カード下端（cardY + th/2 = -38+9 = -29）より下、
    // 日ドット（y=0）より十分上に配置
    const bY  = y - 18; // y-24から-6px下げる

    // ピル型バッジ
    const badge = document.createElementNS(SVG_NS, "rect");
    badge.setAttribute("x",       String(centerX - tw / 2));
    badge.setAttribute("y",       String(bY - th / 2));
    badge.setAttribute("width",   String(tw));
    badge.setAttribute("height",  String(th));
    badge.setAttribute("rx",      "7");
    badge.setAttribute("fill",    "var(--background-secondary)");
    badge.setAttribute("fill-opacity", "1");
    badge.setAttribute("stroke",  "var(--interactive-accent)");
    badge.setAttribute("stroke-width", "0.8");
    badge.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(badge);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(centerX));
    text.setAttribute("y",                 String(bY));
    text.setAttribute("text-anchor",       "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "9");
    text.setAttribute("font-weight",       "600");
    text.setAttribute("fill",              "var(--text-accent)");
    text.textContent = monthLabel;
    this.svg.appendChild(text);
  }

  /** ④ 日ドット＋日ラベル */
  private drawDayDot(day: number, y: number, centerX: number): void {
    // ドット（時間軸上の小さい円）
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx",   String(centerX));
    dot.setAttribute("cy",   String(y));
    dot.setAttribute("r",    "2.5");
    dot.setAttribute("fill", "var(--interactive-accent)");
    dot.setAttribute("fill-opacity", "0.7");
    this.svg.appendChild(dot);

    // 日ラベル（左側）
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(centerX - 10));
    text.setAttribute("y",                 String(y));
    text.setAttribute("text-anchor",       "end");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "10");
    text.setAttribute("fill",              COLOR.dateLabelDay);
    text.textContent = String(day);
    this.svg.appendChild(text);
  }

  // ----------------------------------------------------------
  // ノード描画
  // ----------------------------------------------------------

  private drawNodes(ctx: RenderContext, visTop: number, visBottom: number): void {
    for (const node of ctx.nodes) {
      if (node.y + node.radius < visTop || node.y - node.radius > visBottom) continue;
      const isFiltered = ctx.filteredIds !== null && !ctx.filteredIds.has(node.event.id);
      const isSelected = node.event.id === ctx.selectedId;
      this.drawNode(node, isFiltered, isSelected, ctx);
    }
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

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(node.x));
    circle.setAttribute("cy", String(node.y));
    circle.setAttribute("r",  String(node.radius));
    circle.setAttribute("fill",         isFiltered ? COLOR.nodeFiltered : node.event.color);
    circle.setAttribute("fill-opacity", isFiltered ? "0.25" : "1");
    circle.setAttribute("stroke",       isSelected ? COLOR.nodeStroke : "none");
    circle.setAttribute("stroke-width", isSelected ? "2.5" : "0");
    g.appendChild(circle);

    if (node.event.error) {
      const warn = document.createElementNS(SVG_NS, "text");
      warn.setAttribute("x",                 String(node.x + node.radius - 2));
      warn.setAttribute("y",                 String(node.y - node.radius + 2));
      warn.setAttribute("font-size",         "10");
      warn.setAttribute("dominant-baseline", "auto");
      warn.setAttribute("fill",              COLOR.errorIcon);
      warn.textContent = "⚠";
      g.appendChild(warn);
    }

    g.addEventListener("mouseenter", (e: MouseEvent) => {
      this.tooltip.show(node.event, e.clientX, e.clientY);
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
      this.startDrag(e, node, circle);
    });

    this.svg.appendChild(g);
  }

  // ----------------------------------------------------------
  // 関係線描画
  // ----------------------------------------------------------

  private drawRelations(
    ctx: RenderContext,
    visTop: number,
    visBottom: number,
    defs: SVGDefsElement
  ): void {
    const { edges, selectedId, settings } = ctx;
    const mode = settings.relationDisplayMode;
    if (mode === "hidden") return;

    if (settings.relationArrowStyle !== "none") {
      this.addArrowMarker(defs, settings);
    }

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
    const dy       = toNode.y - fromNode.y;
    const cpOffset = (strength / 100) * Math.max(40, Math.abs(dy) * 0.4);

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d",
      `M ${fromNode.x} ${fromNode.y} C ${fromNode.x + cpOffset} ${fromNode.y + dy * 0.3}, ` +
      `${toNode.x - cpOffset} ${toNode.y - dy * 0.3}, ${toNode.x} ${toNode.y}`
    );
    path.setAttribute("fill",           "none");
    path.setAttribute("stroke",         settings.relationColor);
    path.setAttribute("stroke-width",   String(settings.relationWidth));
    path.setAttribute("stroke-opacity", String(settings.relationOpacity));

    if (settings.relationStyle === "dashed") path.setAttribute("stroke-dasharray", "6 4");
    else if (settings.relationStyle === "dotted") path.setAttribute("stroke-dasharray", "2 4");

    if (settings.relationArrowStyle !== "none") {
      const colorKey = settings.relationColor.replace(/[^a-zA-Z0-9]/g, "");
      path.setAttribute("marker-end", `url(#ntj-arrow-${settings.relationArrowStyle}-${colorKey})`);
    }

    this.svg.appendChild(path);
  }

  private addArrowMarker(defs: SVGDefsElement, settings: NovelsTimelineSettings): void {
    const style    = settings.relationArrowStyle;
    const colorKey = settings.relationColor.replace(/[^a-zA-Z0-9]/g, "");
    const markerId = `ntj-arrow-${style}-${colorKey}`;
    if (defs.querySelector(`#${markerId}`)) return;

    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id",           markerId);
    marker.setAttribute("viewBox",      "0 0 10 10");
    marker.setAttribute("refX",         "8");
    marker.setAttribute("refY",         "5");
    marker.setAttribute("markerWidth",  "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient",       "auto-start-reverse");

    const shape = document.createElementNS(SVG_NS, "path");
    if (style === "triangle") {
      shape.setAttribute("d",      "M0 0L10 5L0 10Z");
      shape.setAttribute("fill",   settings.relationColor);
      shape.setAttribute("stroke", "none");
    } else {
      shape.setAttribute("d",              "M2 1L8 5L2 9");
      shape.setAttribute("fill",           "none");
      shape.setAttribute("stroke",         settings.relationColor);
      shape.setAttribute("stroke-width",   "1.5");
      shape.setAttribute("stroke-linecap", "round");
    }
    marker.appendChild(shape);
    defs.appendChild(marker);
  }

  // ----------------------------------------------------------
  // Gap 描画
  // ----------------------------------------------------------

  private drawGaps(ctx: RenderContext, visTop: number, visBottom: number): void {
    const width = this.container.clientWidth || 800;
    for (const gap of ctx.gaps) {
      if (gap.y < visTop || gap.y > visBottom) continue;
      const el = this.gapRenderer.render(gap, ctx.centerX, width);
      el.addEventListener("click", () => ctx.onGapClick(gap));
      this.svg.appendChild(el);
    }
  }

  // ----------------------------------------------------------
  // Drag & Drop
  // ----------------------------------------------------------

  private startDrag(e: MouseEvent, node: LayoutNode, circle: SVGCircleElement): void {
    this.dragState = {
      active:    true,
      eventId:   node.event.id,
      startX:    e.clientX,
      currentX:  e.clientX,
      laneWidth: 80,
      circle,
    };
    circle.style.cursor = "grabbing";
  }

  private onDragMove(e: MouseEvent, _ctx: RenderContext): void {
    if (!this.dragState.active || !this.dragState.circle) return;
    const svgDx = this.clientDxToSvgDx(e.clientX - this.dragState.currentX);
    const cx    = parseFloat(this.dragState.circle.getAttribute("cx") ?? "0");
    this.dragState.circle.setAttribute("cx", String(cx + svgDx));
    this.dragState.currentX = e.clientX;
  }

  private onDragEnd(e: MouseEvent, ctx: RenderContext): void {
    if (!this.dragState.active) return;
    const totalDx  = e.clientX - this.dragState.startX;
    const laneShift = Math.round(this.clientDxToSvgDx(totalDx) / this.dragState.laneWidth);
    if (laneShift !== 0) ctx.onLaneDrop(this.dragState.eventId, laneShift);
    if (this.dragState.circle) this.dragState.circle.style.cursor = "grab";
    this.dragState.active = false;
  }

  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------

  clientYToSvgY(clientY: number): number {
    // SVG標準の座標変換を使用する。
    // getBoundingClientRect は overflow:scroll コンテナ内では
    // rect.height = コンテナの viewport 高さ（SVG全体高さではない）を返すため、
    // scaleY の計算が狂う。getScreenCTM() はSVGの実際の変換行列を返すので正確。
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      // ctm.d = Y方向のスケール（SVGユーザー単位/cssピクセル）
      // (clientY - ctm.f) / ctm.d でSVGユーザー座標のY値が得られる
      return (clientY - ctm.f) / ctm.d;
    }
    // フォールバック（ctm が取得できない場合）
    const rect = this.svg.getBoundingClientRect();
    const totalH = parseFloat(this.svg.getAttribute("height") ?? "1");
    return (clientY - rect.top + this.container.scrollTop)
         * (totalH / (rect.height || 1));
  }

  private clientDxToSvgDx(clientDx: number): number {
    const rect   = this.svg.getBoundingClientRect();
    const totalW = parseFloat(this.svg.getAttribute("width") ?? "1");
    return clientDx * (totalW / (rect.width || 1));
  }

  getSvgElement(): SVGSVGElement { return this.svg; }

  destroy(): void {
    this.tooltip.hide();
    this.tooltip.destroy();
    if (this.container.contains(this.svg)) this.container.removeChild(this.svg);
  }
}
