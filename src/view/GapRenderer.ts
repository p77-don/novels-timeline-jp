// ============================================================
// GapRenderer.ts — Gap（時間圧縮）のSVG要素生成
// ============================================================

import { GapSegment } from "../types/TimelineTypes";

const SVG_NS = "http://www.w3.org/2000/svg";

// Gap カードを時間軸から右にオフセット（ルーラー1〜3相当）
const GAP_X_OFFSET = 100;

export class GapRenderer {
  render(gap: GapSegment, centerX: number, _svgWidth: number): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
    g.setAttribute("class", "ntj-gap");
    g.style.cursor = "pointer";

    const y         = gap.y;
    const gapX      = centerX + GAP_X_OFFSET;
    const labelText = gap.expanded ? `▲ ${gap.label}` : `▼ ${gap.label}`;
    const labelW    = labelText.length * 8 + 28;
    const labelH    = 22;
    const nodeR     = 5; // 時間軸上のGap専用ノードの半径

    // ── 時間軸上のGap専用ノード（ひし形）──
    const dx = nodeR;
    const dy = nodeR;
    const diamond = document.createElementNS(SVG_NS, "polygon");
    const pts = [
      `${centerX},${y - dy}`,
      `${centerX + dx},${y}`,
      `${centerX},${y + dy}`,
      `${centerX - dx},${y}`,
    ].join(" ");
    diamond.setAttribute("points",       pts);
    diamond.setAttribute("fill",         "var(--background-secondary)");
    diamond.setAttribute("stroke",       "var(--text-muted)");
    diamond.setAttribute("stroke-width", "1.5");
    g.appendChild(diamond);

    // ── 実線の接続線（ノード右端 → カード左端）──
    const lineX1 = centerX + dx;
    const lineX2 = gapX - labelW / 2;
    const connector = document.createElementNS(SVG_NS, "line");
    connector.setAttribute("x1",           String(lineX1));
    connector.setAttribute("y1",           String(y));
    connector.setAttribute("x2",           String(lineX2));
    connector.setAttribute("y2",           String(y));
    connector.setAttribute("stroke",       "var(--text-muted)");
    connector.setAttribute("stroke-width", "1");
    g.appendChild(connector);

    // ── ドロップシャドウ ──
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x",       String(gapX - labelW / 2 + 2));
    shadow.setAttribute("y",       String(y - labelH / 2 + 2));
    shadow.setAttribute("width",   String(labelW));
    shadow.setAttribute("height",  String(labelH));
    shadow.setAttribute("rx",      "6");
    shadow.setAttribute("fill",    "rgba(0,0,0,0.18)");
    g.appendChild(shadow);

    // ── カード本体 ──
    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x",       String(gapX - labelW / 2));
    card.setAttribute("y",       String(y - labelH / 2));
    card.setAttribute("width",   String(labelW));
    card.setAttribute("height",  String(labelH));
    card.setAttribute("rx",      "6");
    card.setAttribute("fill",    "var(--background-secondary)");
    card.setAttribute("stroke",  "var(--background-modifier-border)");
    card.setAttribute("stroke-width", "0.8");
    g.appendChild(card);

    // ハイライト上辺
    const highlight = document.createElementNS(SVG_NS, "rect");
    highlight.setAttribute("x",            String(gapX - labelW / 2 + 2));
    highlight.setAttribute("y",            String(y - labelH / 2 + 1));
    highlight.setAttribute("width",        String(labelW - 4));
    highlight.setAttribute("height",       "1");
    highlight.setAttribute("rx",           "1");
    highlight.setAttribute("fill",         "var(--background-primary)");
    highlight.setAttribute("fill-opacity", "0.5");
    g.appendChild(highlight);

    // ── テキスト ──
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(gapX));
    text.setAttribute("y",                 String(y));
    text.setAttribute("text-anchor",       "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         "11");
    text.setAttribute("font-weight",       "500");
    text.setAttribute("fill",              "var(--text-muted)");
    text.textContent = labelText;
    g.appendChild(text);

    return g;
  }
}
