// ============================================================
// FilterEngine.ts
// Novels Timeline JP — 検索・フィルタ
// ============================================================

import Fuse from "fuse.js";
import { TimelineEvent } from "../types/TimelineTypes";
import { FilterState } from "../types/TimelineTypes";

export class FilterEngine {
  private fuse: Fuse<TimelineEvent> | null = null;

  // ----------------------------------------------------------
  // インデックス更新
  // ----------------------------------------------------------

  buildIndex(events: TimelineEvent[]): void {
    this.fuse = new Fuse(events, {
      keys: ["displayTitle", "summary"],
      threshold: 0.4,       // 曖昧さの許容度（0=完全一致, 1=何でも一致）
      distance: 200,
      includeScore: false,
      useExtendedSearch: false,
    });
  }

  // ----------------------------------------------------------
  // フィルタ適用
  // ----------------------------------------------------------

  /**
   * FilterState に基づいてイベント一覧を絞り込む
   *
   * 条件:
   *   - searchQuery:    displayTitle または summary に曖昧一致
   *   - characters:     選択された人物のいずれかが含まれる（OR）
   *   - locations:      選択された場所のいずれかが含まれる（OR）
   *   - カテゴリ間:      AND
   */
  apply(events: TimelineEvent[], filter: FilterState): TimelineEvent[] {
    let result = events;

    // 検索キーワード
    if (filter.searchQuery.trim() !== "" && this.fuse) {
      const searchResults = this.fuse.search(filter.searchQuery.trim());
      const matchedIds = new Set(searchResults.map((r) => r.item.id));
      result = result.filter((e) => matchedIds.has(e.id));
    }

    // 登場人物フィルタ（OR）
    if (filter.characters.size > 0) {
      result = result.filter((e) =>
        e.characters.some((c) => filter.characters.has(c))
      );
    }

    // 場所フィルタ（OR）
    if (filter.locations.size > 0) {
      result = result.filter((e) =>
        e.locations.some((l) => filter.locations.has(l))
      );
    }

    return result;
  }

  // ----------------------------------------------------------
  // フィルタ選択肢一覧の生成
  // ----------------------------------------------------------

  /** 全イベントから登場人物の重複なし一覧を返す */
  allCharacters(events: TimelineEvent[]): string[] {
    const set = new Set<string>();
    for (const e of events) {
      for (const c of e.characters) set.add(c);
    }
    return Array.from(set).sort();
  }

  /** 全イベントから場所の重複なし一覧を返す */
  allLocations(events: TimelineEvent[]): string[] {
    const set = new Set<string>();
    for (const e of events) {
      for (const l of e.locations) set.add(l);
    }
    return Array.from(set).sort();
  }
}
