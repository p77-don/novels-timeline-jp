// ============================================================
// RelationEngine.ts
// Novels Timeline JP — 関係線の解決
// ============================================================

import { TimelineEvent } from "../types/TimelineTypes";
import { RelationEdge, LayoutNode } from "../types/TimelineTypes";

export class RelationEngine {
  /**
   * EventStore の全イベントと LayoutNode 一覧から
   * 有効な RelationEdge 一覧を生成する
   *
   * links フィールドはファイル名一致で解決する
   */
  buildEdges(
    events: TimelineEvent[],
    nodes: LayoutNode[]
  ): RelationEdge[] {
    const nodeMap = new Map<string, LayoutNode>();
    for (const node of nodes) {
      nodeMap.set(node.event.id, node);
    }

    const edges: RelationEdge[] = [];
    // 双方向の重複チェックをO(1)で行うためのキー集合
    // （"a\u0000b" と "b\u0000a" のどちらかが既にあれば重複とみなす）
    const seenKeys = new Set<string>();

    for (const event of events) {
      const fromNode = nodeMap.get(event.id);
      if (!fromNode) continue;

      for (const linkId of event.links) {
        // ファイル名一致で解決（拡張子なし）
        const toNode = nodeMap.get(linkId);
        if (!toNode) continue; // ⚠ Missing Event: Renderer側でエラー表示

        // 重複チェック（双方向に重複する場合は1本のみ）
        const key = event.id < linkId
          ? `${event.id}\u0000${linkId}`
          : `${linkId}\u0000${event.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        edges.push({
          fromId:   event.id,
          toId:     linkId,
          fromNode,
          toNode,
        });
      }
    }

    return edges;
  }

  /**
   * 選択中のイベントIDに関連するエッジのみを返す
   */
  filterBySelected(edges: RelationEdge[], selectedId: string): RelationEdge[] {
    return edges.filter(
      (e) => e.fromId === selectedId || e.toId === selectedId
    );
  }
}
