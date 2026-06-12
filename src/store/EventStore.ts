// ============================================================
// EventStore.ts
// Novels Timeline JP — イベント一覧の保持と差分更新
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";

export class EventStore {
  /** イベントID → TimelineEvent */
  private store = new Map<string, TimelineEvent>();

  // ----------------------------------------------------------
  // 読み取り
  // ----------------------------------------------------------

  getAll(): TimelineEvent[] {
    return Array.from(this.store.values());
  }

  getById(id: string): TimelineEvent | undefined {
    return this.store.get(id);
  }

  getByFilePath(filePath: string): TimelineEvent | undefined {
    for (const event of this.store.values()) {
      if (event.filePath === filePath) return event;
    }
    return undefined;
  }

  count(): number {
    return this.store.size;
  }

  // ----------------------------------------------------------
  // 書き込み（差分更新）
  // ----------------------------------------------------------

  /** イベントを追加または上書き */
  upsert(event: TimelineEvent): void {
    this.store.set(event.id, event);
  }

  /** イベントIDで削除 */
  deleteById(id: string): void {
    this.store.delete(id);
  }

  /** ファイルパスで削除 */
  deleteByFilePath(filePath: string): void {
    for (const [id, event] of this.store) {
      if (event.filePath === filePath) {
        this.store.delete(id);
        return;
      }
    }
  }

  /** 全削除（リビルド時） */
  clear(): void {
    this.store.clear();
  }

  // ----------------------------------------------------------
  // フィルタ済みリストを返す（FilterEngine から使用）
  // ----------------------------------------------------------

  getFiltered(predicate: (e: TimelineEvent) => boolean): TimelineEvent[] {
    return this.getAll().filter(predicate);
  }

  // ----------------------------------------------------------
  // timelineOrder 順にソートして返す
  // ----------------------------------------------------------

  getAllSorted(): TimelineEvent[] {
    return this.getAll().sort((a, b) => a.timelineOrder - b.timelineOrder);
  }
}
