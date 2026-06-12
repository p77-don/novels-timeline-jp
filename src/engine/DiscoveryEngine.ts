// ============================================================
// DiscoveryEngine.ts
// Novels Timeline JP — Vault内イベントファイル探索
// ============================================================

import { TFile, Vault } from "obsidian";
import { TimelineParser } from "../parser/TimelineParser";
import { TimelineEvent } from "../types/TimelineTypes";
import { CalendarSettings } from "../types/TimelineTypes";

export interface DiscoveryResult {
  events: TimelineEvent[];
  /** パースに失敗したファイルのパスとエラーメッセージ */
  errors: Array<{ filePath: string; message: string }>;
}

export class DiscoveryEngine {
  private vault: Vault;
  private parser: TimelineParser;
  private excludedFolders: string[];

  constructor(vault: Vault, calendar: CalendarSettings, excludedFolders: string[] = []) {
    this.vault = vault;
    this.parser = new TimelineParser(calendar);
    this.excludedFolders = excludedFolders;
  }

  updateCalendar(calendar: CalendarSettings): void {
    this.parser.updateCalendar(calendar);
  }

  updateExcludedFolders(folders: string[]): void {
    this.excludedFolders = folders;
  }

  // ----------------------------------------------------------
  // Vault全体を探索して全イベントを返す
  // ----------------------------------------------------------

  async discoverAll(): Promise<DiscoveryResult> {
    const files = this.vault.getMarkdownFiles();
    const targetFiles = files.filter((f) => !this.isExcluded(f.path));

    const events: TimelineEvent[] = [];
    const errors: Array<{ filePath: string; message: string }> = [];

    for (const file of targetFiles) {
      const result = await this.processFile(file);
      if (result === null) continue; // timelineブロックなし = 対象外
      if (result.ok) {
        events.push(result.event);
      } else {
        // invalid_date などエラーがあっても event を持つ場合がある
        // ParseResult の構造上、ok:false でも event が存在するケースはない
        errors.push({ filePath: file.path, message: result.message });
      }
    }

    return { events, errors };
  }

  // ----------------------------------------------------------
  // 単一ファイルを再解析して返す（差分更新用）
  // ----------------------------------------------------------

  async discoverFile(file: TFile): Promise<TimelineEvent | null> {
    if (this.isExcluded(file.path)) return null;
    const result = await this.processFile(file);
    if (!result || !result.ok) return null;
    return result.event;
  }

  // ----------------------------------------------------------
  // ファイルがtimelineブロックを持つか高速チェック（全文読み前）
  // ----------------------------------------------------------

  async hasTimelineBlock(file: TFile): Promise<boolean> {
    const content = await this.vault.cachedRead(file);
    return /^```+novels_timeline_jp/m.test(content);
  }

  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------

  private async processFile(
    file: TFile
  ): Promise<
    | { ok: true; event: TimelineEvent }
    | { ok: false; message: string }
    | null
  > {
    // キャッシュ読み（vault.cachedRead は Obsidian 内部キャッシュを利用）
    let content: string;
    try {
      content = await this.vault.cachedRead(file);
    } catch {
      return { ok: false, message: `ファイル読み込みエラー: ${file.path}` };
    }

    // timelineブロックを持たないファイルは早期リターン（全Vaultスキャンの高速化）
    if (!/^```+novels_timeline_jp/m.test(content)) return null;

    const result = this.parser.parse(content, file.path);
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
