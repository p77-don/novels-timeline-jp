// ============================================================
// CacheStore.ts
// Novels Timeline JP — timelineOrder キャッシュの保存・読み込み
// ============================================================

import { App } from "obsidian";
import { TimelineCache, CacheEntry } from "../types/TimelineTypes";

// 正しいパス（.obsidian/plugins/... が正式なObsidianプラグインデータ置き場）
const CACHE_PATH = ".obsidian/plugins/novels-timeline-jp/timeline-cache.json";

/**
 * JSON.parse() の戻り値（unknown相当）を検証し、正しい形の TimelineCache を返す。
 * - entries がオブジェクトでない場合（null / 配列 / プリミティブ等）は空に補正
 * - 各エントリも order:number, date:string を満たすものだけ採用し、それ以外は破棄する
 * これにより、壊れたキャッシュファイルによる setEntry() / getEntry() での
 * 例外発生（更新・再描画の停止）を防ぐ。
 */
function sanitizeCache(raw: unknown): TimelineCache {
  if (!raw || typeof raw !== "object") {
    return { generatedAt: 0, entries: {} };
  }

  const obj = raw as Record<string, unknown>;
  const generatedAt = typeof obj.generatedAt === "number" && Number.isFinite(obj.generatedAt)
    ? obj.generatedAt
    : 0;

  const entriesRaw = obj.entries;
  const entries: Record<string, CacheEntry> = {};

  if (entriesRaw && typeof entriesRaw === "object" && !Array.isArray(entriesRaw)) {
    for (const [id, value] of Object.entries(entriesRaw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      if (typeof v.order === "number" && Number.isFinite(v.order) && typeof v.date === "string") {
        entries[id] = { order: v.order, date: v.date };
      }
      // 形が合わないエントリは黙って破棄する（不正な1件のために全体を捨てない）
    }
  }

  return { generatedAt, entries };
}

export class CacheStore {
  private app: App;
  private cache: TimelineCache = { generatedAt: 0, entries: {} };

  constructor(app: App) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(CACHE_PATH)) {
        const raw = await adapter.read(CACHE_PATH);
        this.cache = sanitizeCache(JSON.parse(raw));
      }
    } catch {
      this.cache = { generatedAt: 0, entries: {} };
    }
  }

  async save(): Promise<void> {
    try {
      const adapter = this.app.vault.adapter;
      const dir = CACHE_PATH.split("/").slice(0, -1).join("/");
      if (!(await adapter.exists(dir))) {
        await adapter.mkdir(dir);
      }
      this.cache.generatedAt = Date.now();
      await adapter.write(CACHE_PATH, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      console.warn("[NovelsTimelineJP] キャッシュ保存に失敗しました:", e);
    }
  }

  getEntry(id: string): CacheEntry | undefined {
    return this.cache.entries[id];
  }

  setEntry(id: string, entry: CacheEntry): void {
    this.cache.entries[id] = entry;
  }

  deleteEntry(id: string): void {
    delete this.cache.entries[id];
  }

  async clearAll(): Promise<void> {
    this.cache = { generatedAt: 0, entries: {} };
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(CACHE_PATH)) {
        await adapter.remove(CACHE_PATH);
      }
    } catch (e) {
      console.warn("[NovelsTimelineJP] キャッシュ削除に失敗しました:", e);
    }
  }
}
