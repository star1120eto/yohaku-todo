import type { Task } from "./types";

export interface TaskNode {
  task: Task;
  depth: 0 | 1;
  childCount: number;
  completedChildCount: number;
}

/**
 * 表示順が確定した(フィルター・ソート済みの)タスク一覧を受け取り、
 * 親の直後にその子タスクをまとめて挿入したツリー表示用リストを作る。
 * 親がこのリストに含まれない子(フィルターで親だけ除外された場合)は
 * トップレベル扱いにする。
 */
export function buildTaskTree(visible: Task[]): TaskNode[] {
  const byId = new Map(visible.map((t) => [t.id, t]));
  const childrenOf = new Map<string, Task[]>();
  for (const t of visible) {
    if (t.parentId && byId.has(t.parentId)) {
      const list = childrenOf.get(t.parentId) ?? [];
      list.push(t);
      childrenOf.set(t.parentId, list);
    }
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  const nodes: TaskNode[] = [];
  for (const t of visible) {
    const isTopLevel = !t.parentId || !byId.has(t.parentId);
    if (!isTopLevel) continue; // 子は親の位置でまとめて追加済み
    const children = childrenOf.get(t.id) ?? [];
    nodes.push({
      task: t,
      depth: 0,
      childCount: children.length,
      completedChildCount: children.filter((c) => c.completed).length,
    });
    for (const c of children) {
      nodes.push({ task: c, depth: 1, childCount: 0, completedChildCount: 0 });
    }
  }
  return nodes;
}
