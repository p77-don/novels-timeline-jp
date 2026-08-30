// ============================================================
// ColorPresetStore.ts
// Novels Timeline JP — 配色セット（ノード色＋文字色）の保存・読み込み
// ============================================================

import { App } from "obsidian";
import { ColorPreset, ColorPresetFile } from "../types/TimelineTypes";

// CacheStore と同様、正式なObsidianプラグインデータ置き場に保存する
const PRESET_PATH = ".obsidian/plugins/novels-timeline-jp/color-presets.json";

/** 初回起動時に用意しておく既定の配色セット */
const DEFAULT_PRESETS: ColorPreset[] = [
  { id: "default-blue",   name: "青（標準）",   nodeColor: "#4A90E2", textColor: "#ffffff" },
  { id: "default-orange", name: "オレンジ",     nodeColor: "#FFAA00", textColor: "#ffffff" },
  { id: "default-red",    name: "赤",           nodeColor: "#CC4455", textColor: "#ffffff" },
  { id: "default-green",  name: "緑",           nodeColor: "#3FA76E", textColor: "#ffffff" },
  { id: "default-purple", name: "紫",           nodeColor: "#8E6FCE", textColor: "#ffffff" },
  { id: "default-gray",   name: "グレー（既定）", nodeColor: "#808080", textColor: "#ffffff" },
];

export class ColorPresetStore {
  private app: App;
  private presets: ColorPreset[] = [];

  constructor(app: App) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(PRESET_PATH)) {
        const raw = await adapter.read(PRESET_PATH);
        const parsed = JSON.parse(raw) as ColorPresetFile;
        this.presets = Array.isArray(parsed.presets) ? parsed.presets : [];
      } else {
        // 初回起動：既定セットを書き込んでおく
        this.presets = DEFAULT_PRESETS.slice();
        await this.save();
      }
    } catch (e) {
      console.warn("[NovelsTimelineJP] 配色セットの読み込みに失敗しました:", e);
      this.presets = DEFAULT_PRESETS.slice();
    }
  }

  async save(): Promise<void> {
    try {
      const adapter = this.app.vault.adapter;
      const dir = PRESET_PATH.split("/").slice(0, -1).join("/");
      if (!(await adapter.exists(dir))) {
        await adapter.mkdir(dir);
      }
      const data: ColorPresetFile = { presets: this.presets };
      await adapter.write(PRESET_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn("[NovelsTimelineJP] 配色セットの保存に失敗しました:", e);
    }
  }

  getAll(): ColorPreset[] {
    return this.presets.slice();
  }

  getById(id: string): ColorPreset | undefined {
    return this.presets.find((p) => p.id === id);
  }

  /**
   * イベントの color フィールド値（配色セットIDまたはレガシーな生HEX値）を
   * 実際の描画色（ノード色・文字色）に解決する。
   *   1. 配色セットIDと一致すれば、そのセットの色を返す。
   *   2. HEXカラーコードとして解釈できれば、それをノード色とし、文字色は白とする
   *      （配色セット導入前のノート・カスタム値への後方互換）。
   *   3. どちらでもなければ既定のグレーにフォールバックする。
   */
  resolve(colorField: string): { nodeColor: string; textColor: string } {
    const preset = this.getById(colorField);
    if (preset) return { nodeColor: preset.nodeColor, textColor: preset.textColor };

    if (/^#[0-9A-Fa-f]{3,8}$/.test(colorField)) {
      return { nodeColor: colorField, textColor: "#ffffff" };
    }

    return { nodeColor: "#808080", textColor: "#ffffff" };
  }

  /** 追加または更新（同一IDが存在すれば上書き）。保存はしない。 */
  upsert(preset: ColorPreset): void {
    const idx = this.presets.findIndex((p) => p.id === preset.id);
    if (idx >= 0) {
      this.presets[idx] = preset;
    } else {
      this.presets.push(preset);
    }
  }

  /** 削除。保存はしない。 */
  remove(id: string): void {
    this.presets = this.presets.filter((p) => p.id !== id);
  }

  /** 全件を丸ごと置き換える。保存はしない。 */
  replaceAll(presets: ColorPreset[]): void {
    this.presets = presets.slice();
  }

  /** 新規ID生成（作成時刻ベース） */
  static generateId(): string {
    return `preset-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
}
