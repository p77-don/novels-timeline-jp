// ============================================================
// DiscoveryEngine.ts
// Novels Timeline JP — Vault内イベントファイル探索
// ============================================================
//
// v2.0: データがコードブロックからフロントマターへ移行したことに伴い、
// ファイル内容の正規表現スキャンではなく、Obsidian の metadataCache
// （既にパース済みのフロントマター）を利用する方式に変更した。
// これにより探索が高速化され、また YAML パースエラーの心配もなくなる。
// ============================================================

import { App, CachedMetadata, TFile, normalizePath } from "obsidian";
import { TimelineParser, NTJP_KEYS } from "../parser/TimelineParser";
import { TimelineEvent } from "../types/TimelineTypes";
import { CalendarSettings } from "../types/TimelineTypes";

export interface DiscoveryResult {
  events: TimelineEvent[];
  /** パースに失敗したファイルのパスとエラーメッセージ */
  errors: Array<{ filePath: string; message: string }>;
}

type ProcessResult =
  | { ok: true; event: TimelineEvent }
  | { ok: false; message: string }
  | null;

export class DiscoveryEngine {
  private app: App;
  private parser: TimelineParser;
  private excludedFolders: string[];

  constructor(app: App, calendar: CalendarSettings, excludedFolders: string[] = []) {
    this.app = app;
    this.parser = new TimelineParser(calendar);
    this.excludedFolders = DiscoveryEngine.normalizeFolders(excludedFolders);
  }

  updateCalendar(calendar: CalendarSettings): void {
    this.parser.updateCalendar(calendar);
  }

  updateExcludedFolders(folders: string[]): void {
    this.excludedFolders = DiscoveryEngine.normalizeFolders(folders);
  }

  /**
   * data.json を直接編集した場合など、設定タブを経由しない値が
   * 渡されるケースに備え、ここでも normalizePath() を掛けておく。
   */
  private static normalizeFolders(folders: string[]): string[] {
    return folders
      .map((f) => f.trim())
      .filter((f) => f !== "")
      .map((f) => normalizePath(f));
  }

  // ----------------------------------------------------------
  // Vault全体を探索して全イベントを返す
  // ----------------------------------------------------------

  async discoverAll(): Promise<DiscoveryResult> {
    const files = this.app.vault.getMarkdownFiles();
    const targetFiles = files.filter((f) => !this.isExcluded(f.path));

    const events: TimelineEvent[] = [];
    const errors: Array<{ filePath: string; message: string }> = [];

    for (const file of targetFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const result = this.processFrontmatter(file, cache);
      if (result === null) continue; // NTJP_date なし = 対象外
      if (result.ok) {
        events.push(result.event);
      } else {
        errors.push({ filePath: file.path, message: result.message });
      }
    }

    return { events, errors };
  }

  // ----------------------------------------------------------
  // 単一ファイルを再解析して返す（rename・初回検出時などに使用）
  // ----------------------------------------------------------

  async discoverFile(file: TFile): Promise<TimelineEvent | null> {
    if (this.isExcluded(file.path)) return null;
    const cache = this.app.metadataCache.getFileCache(file);
    const result = this.processFrontmatter(file, cache);
    return result && result.ok ? result.event : null;
  }

  // ----------------------------------------------------------
  // metadataCache "changed" イベントで渡されるcacheをそのまま使う版
  // （再取得不要・常に最新のフロントマターが保証される）
  // ----------------------------------------------------------

  buildEventFromCache(file: TFile, cache: CachedMetadata | null): TimelineEvent | null {
    if (this.isExcluded(file.path)) return null;
    const result = this.processFrontmatter(file, cache);
    return result && result.ok ? result.event : null;
  }

  // ----------------------------------------------------------
  // ファイルがイベント用フロントマターを持つか（NTJP_date の有無で判定）
  // ----------------------------------------------------------

  hasEventFrontmatter(file: TFile): boolean {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return !!fm && fm[NTJP_KEYS.date] !== undefined;
  }

  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------

  private processFrontmatter(file: TFile, cache: CachedMetadata | null): ProcessResult {
    const fm = cache?.frontmatter;

    // NTJP_date が無いファイルはイベント対象外（早期リターン）
    if (!fm || fm[NTJP_KEYS.date] === undefined) return null;

    const result = this.parser.parse(fm as Record<string, unknown>, file.path);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    return { ok: true, event: result.event };
  }

  private isExcluded(filePath: string): boolean {
    return this.excludedFolders.some(
      (folder) => filePath === folder || filePath.startsWith(folder + "/")
    );
  }
}
