// ============================================================
// GapRenderer.ts — Gap（時間圧縮）のSVG要素生成
// 縦軸タイムライン版: 時間軸線（垂直）上にマーカーを置き、
// そこから右へ接続線を伸ばしてGAP列内にラベルカードを表示する。
// ============================================================

import { GapSegment } from "../types/TimelineTypes";
import { getIcon } from "obsidian";

const SVG_NS = "http://www.w3.org/2000/svg";

export class GapRenderer {
  /**
   * @param gap        Gapセグメント（gap.y は時間軸上のSVG Y座標）
   * @param axisX      時間軸（垂直線）のSVG X座標
   * @param gapColW    GAP専用列の幅（axisXから右に確保された帯の幅）
   * @param slotHeight このGapに割り当てられた縦幅（Layout側の配置高さと一致させる）。
   *                   カードの縦幅はこの範囲を超えないようにする（GAP同士の重なり防止）。
   *                   カードの横幅は常にGAP列の幅（左右にOUTER_MARGIN分の余白を確保）に
   *                   収まるようクランプし、文字が収まらない場合はフォントサイズを縮小、
   *                   それでも収まらない場合は `textLength` で描画幅そのものを強制する。
   */
  render(gap: GapSegment, axisX: number, gapColW: number, slotHeight: number): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
    g.setAttribute("class", "ntj-gap");

    const y          = gap.y; // gap.y は実体としてSVG Y座標
    // カードは列の中央に配置する。以前は「+4」で隣のレーン列側へ寄せていたが、
    // その分だけカード右端が列境界（＝レーン1列の開始位置）ちょうどに達してしまい、
    // フォーカス枠（outline-offset分）が隣のレーン列へはみ出す原因になっていた。
    // 列境界の両側に必ず OUTER_MARGIN 分の余白を確保する。
    const OUTER_MARGIN = 6; // 列境界とカード端の最小余白(px)。フォーカス枠の食い込み防止も兼ねる。
    const cardX       = axisX + gapColW / 2;
    // 圧縮中（クリックで展開できる）: chevrons-up-down
    // 展開中（クリックで圧縮できる）: chevrons-down-up
    const iconId      = gap.expanded ? "chevrons-down-up" : "chevrons-up-down";
    const labelText   = gap.label;

    // カード横幅は GAP列の幅を上限とし、それに収まるようフォントサイズを調整する
    const PADDING     = 10;
    const ICON_SIZE   = 12;
    const ICON_GAP    = 3; // アイコンとテキストの間隔
    const minFont     = 7;
    const maxFont     = 11;
    const labelW      = Math.max(28, gapColW - OUTER_MARGIN * 2);
    const charWidthRatio = 0.62; // フォントサイズに対するおおよその1文字幅（目安。誤差はtextLengthで吸収する）
    // 利用可能なテキスト描画幅（アイコン・パディングを除いたカード内側の幅）
    const availableTextW = Math.max(10, labelW - PADDING - ICON_SIZE - ICON_GAP);
    let fontSize = Math.min(
      maxFont,
      availableTextW / Math.max(1, labelText.length) / charWidthRatio
    );
    fontSize = Math.max(minFont, fontSize);

    // カード縦幅は割り当てられたスロット高さに収める（GAP同士の重なり防止）
    const labelH      = Math.min(22, Math.max(14, slotHeight - 4));
    const nodeR       = 5; // 時間軸上のGap専用ノードの半径

    // ── 時間軸上のGap専用ノード（ひし形）──
    const dx = nodeR;
    const dy = nodeR;
    const diamond = document.createElementNS(SVG_NS, "polygon");
    const pts = [
      `${axisX},${y - dy}`,
      `${axisX + dx},${y}`,
      `${axisX},${y + dy}`,
      `${axisX - dx},${y}`,
    ].join(" ");
    diamond.setAttribute("points",       pts);
    diamond.setAttribute("fill",         "var(--background-secondary)");
    diamond.setAttribute("stroke",       "var(--text-muted)");
    diamond.setAttribute("stroke-width", "1.5");
    g.appendChild(diamond);

    // ── 実線の接続線（ノード右端 → カード左端）──
    const lineX1 = axisX + dx;
    const lineX2 = cardX - labelW / 2;
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
    shadow.setAttribute("x",       String(cardX - labelW / 2 + 2));
    shadow.setAttribute("y",       String(y - labelH / 2 + 2));
    shadow.setAttribute("width",   String(labelW));
    shadow.setAttribute("height",  String(labelH));
    shadow.setAttribute("rx",      "6");
    shadow.setAttribute("fill",    "rgba(0,0,0,0.18)");
    g.appendChild(shadow);

    // ── カード本体 ──
    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x",       String(cardX - labelW / 2));
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
    highlight.setAttribute("x",            String(cardX - labelW / 2 + 2));
    highlight.setAttribute("y",            String(y - labelH / 2 + 1));
    highlight.setAttribute("width",        String(labelW - 4));
    highlight.setAttribute("height",       "1");
    highlight.setAttribute("rx",           "1");
    highlight.setAttribute("fill",         "var(--background-primary)");
    highlight.setAttribute("fill-opacity", "0.5");
    g.appendChild(highlight);

    // ── アイコン + テキスト（カード内で中央寄せしたグループとして配置） ──
    // 文字幅の推定（charWidthRatio）は全角（年・か月・日等）と半角数字が混在する
    // ラベルに対しては誤差が出やすく、日数が大きく桁数の多いラベル
    // （例:「12年10か月29日」）だと実際の描画幅が推定より広くなり、
    // カード・GAP列の外へテキストがはみ出すことがあった。
    // 推定幅が使用可能幅を超える場合は availableTextW にクランプし、
    // SVGの `textLength` 属性で実際の描画幅を強制的にその値へ合わせることで、
    // 推定誤差に関わらずカード内に収まることを保証する。
    const estimatedTextWidth = labelText.length * fontSize * charWidthRatio;
    const renderTextWidth    = Math.min(estimatedTextWidth, availableTextW);
    const groupWidth = ICON_SIZE + ICON_GAP + renderTextWidth;
    const groupStartX = cardX - groupWidth / 2;

    const icon = getIcon(iconId);
    if (icon) {
      icon.setAttribute("width",  String(ICON_SIZE));
      icon.setAttribute("height", String(ICON_SIZE));
      icon.setAttribute("x",      String(groupStartX));
      icon.setAttribute("y",      String(y - ICON_SIZE / 2));
      icon.setAttribute("stroke", "var(--text-muted)");
      g.appendChild(icon);
    }

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x",                 String(groupStartX + ICON_SIZE + ICON_GAP));
    text.setAttribute("y",                 String(y));
    text.setAttribute("text-anchor",       "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size",         String(fontSize.toFixed(1)));
    text.setAttribute("font-weight",       "500");
    text.setAttribute("fill",              "var(--text-muted)");
    // 実描画幅を renderTextWidth に固定し、カード外へのはみ出しを防ぐ安全弁。
    // 推定幅が使用可能幅に収まっている場合は自然な字間のまま描画されるよう省略する。
    if (estimatedTextWidth > availableTextW) {
      text.setAttribute("textLength",  String(renderTextWidth.toFixed(1)));
      text.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
    text.textContent = labelText;
    g.appendChild(text);

    return g;
  }
}
