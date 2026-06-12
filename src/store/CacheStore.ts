// ============================================================
// CacheStore.ts
// Novels Timeline JP — timelineOrder キャッシュの保存・読み込み
// ============================================================

import { App } from "obsidian";
import { TimelineCache, CacheEntry } from "../types/TimelineTypes";

// 正しいパス（.obsidian/plugins/... が正式なObsidianプラグインデータ置き場）
const CACHE_PATH = ".obsidian/plugins/novels-timeline-jp/timeline-cache.json";

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
        this.cache = JSON.parse(raw) as TimelineCache;
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
