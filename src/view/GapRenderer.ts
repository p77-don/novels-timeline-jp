// ============================================================
// GapRenderer.ts — Gap（時間圧縮）のSVG要素生成
// 横軸タイムライン版: 時間軸線（水平）上にマーカーを置き、
// そこから下へ接続線を伸ばしてラベルカードを表示する。
// ============================================================

import { GapSegment } from "../types/TimelineTypes";

const SVG_NS = "http://www.w3.org/2000/svg";

export class GapRenderer {
  /**
   * @param gap      Gapセグメント（gap.y は時間軸上のSVG X座標）
   * @param axisY    時間軸（水平線）のSVG Y座標
   * @param gapRowH  GAP専用レーンの高さ（axisYから下に確保された帯の高さ）
   */
  /**
   * @param gap        Gapセグメント（gap.y は時間軸上のSVG X座標）
   * @param axisY      時間軸（水平線）のSVG Y座標
   * @param gapRowH    GAP専用レーンの高さ（axisYから下に確保された帯の高さ）
   * @param slotWidth  このGapに割り当てられた横幅（Layout側の配置幅と一致させる）。
   *                   カードはこの幅を超えないようにし、文字が収まらない場合は
   *                   フォントサイズを縮小して対応する（GAP同士の重なり防止）。
   */
  render(gap: GapSegment, axisY: number, gapRowH: number, slotWidth: number): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
    g.setAttribute("class", "ntj-gap");
    g.style.cursor = "pointer";

    const x         = gap.y; // gap.y は実体としてSVG X座標
    const cardY      = axisY + gapRowH / 2 + 4; // GAP行の中央よりやや下（ノード寄り）
    const labelText  = gap.expanded ? `▲ ${gap.label}` : `▼ ${gap.label}`;

    // カード幅は slotWidth を上限とし、それに収まるようフォントサイズを調整する
    const PADDING    = 10;
    const minFont    = 7;
    const maxFont    = 11;
    const labelW     = Math.max(28, slotWidth - 4); // 隣接スロットとの間に僅かな余白
    const charWidthRatio = 0.62; // フォントサイズに対するおおよその1文字幅
    let fontSize = Math.min(maxFont, (labelW - PADDING) / Math.max(1, labelText.length) / charWidthRatio);
    fontSize = Math.max(minFont, fontSize);

    const labelH     = Math.min(22, gapRowH - 8);
    const nodeR      = 5; // 時間軸上のGap専用ノードの半径

    // ── 時間軸上のGap専用ノード（ひし形）──
    const dx = nodeR;
    const dy = nodeR;
    const diamond = document.createElementNS(SVG_NS, "polygon");
    const pts = [
      `${x},${axisY - dy}`,
      `${x + dx},${axisY}`,
      `${x},${axisY + dy}`,
      `${x - dx},${axisY}`,
    ].join(" ");
    diamond.setAttribute("points",       pts);
    diamond.setAttribute("fill",         "var(--background-secondary)");
    diamond.setAttribute("stroke",       "var(--text-muted)");
    diamond.setAttribute("stroke-width", "1.5");
    g.appendChild(diamond);

    // ── 実線の接続線（ノード下端 → カード上端）──
    const lineY1 = axisY + dy;
    const lineY2 = cardY - labelH / 2;
    const connector = document.createElementNS(SVG_NS, "line");
    connector.setAttribute("x1",           String(x));
    connector.setAttribute("y1",           String(lineY1));
    connector.setAttribute("x2",           String(x));
    connector.setAttribute("y2",           String(lineY2));
    connector.setAttribute("stroke",       "var(--text-muted)");
    connector.setAttribute("stroke-width", "1");
    g.appendChild(connector);

    // ── ドロップシャドウ ──
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x",       String(x - labelW / 2 + 2));
    shadow.setAttribute("y",       String(cardY - labelH / 2 + 2));
    shadow.setAttribute("width",   String(labelW));
    shadow.setAttribute("height",  String(labelH));
    shadow.setAttribute("rx",      "6");
    shadow.setAttribute("fill",    "rgba(0,0,0,0.18)");
    g.appendChild(shadow);

    // ── カード本体 ──
    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x",       String(x - labelW / 2));
    card.setAttribute("y",       String(cardY - labelH / 2));
    card.setAttribute("width",   String(labelW));
    card.setAttribute("height",  String(labelH));
    card.setAttribute("rx",      "6");
    card.setAttribute("fill",    "var(--background-secondary)");
    card.setAttribute("stroke",  "var(--background-modifier-border)");
    card.setAttribute("stroke-width", "0.8");
    g.appendChild(card);

    // ハイライト上辺
    const highlight = document.createElementNS(SVG_NS, "rect");
    highlight.setAttribute("x",            String(x - labelW / 2 + 2));
    highlight.setAttribute("y",            String(cardY - labelH / 2 + 1));
    highlight.setAttribute("width",        String(labelW - 4));
    highlight.setAttribute("height",       "1");
    highlight.setAttribute("rx",           "1");
    highlight.setAttribute("fill",         "var(--background-primary)");
    highlight.setAttribute("fill-opacity", "0.5");
    g.appendChild(highlight);

    // ── テキスト ──
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(x));
    text.setAttribute("y",                 String(cardY));
    text.setAttribute("text-anchor",       "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         String(fontSize.toFixed(1)));
    text.setAttribute("font-weight",       "500");
    text.setAttribute("fill",              "var(--text-muted)");
    text.textContent = labelText;
    g.appendChild(text);

    return g;
  }
}
