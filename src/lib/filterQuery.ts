import type { Folder, Priority, Task } from "./types";

export type DueCond = "today" | "week" | "overdue" | "none";

export interface ParsedQuery {
  priorities: Priority[];
  tags: string[];
  due: DueCond | null;
  folderName: string | null;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  "高": 3, "中": 2, "低": 1,
  high: 3, med: 2, medium: 2, low: 1,
  "1": 3, "2": 2, "3": 1,
};

const DUE_CONDS: DueCond[] = ["today", "week", "overdue", "none"];

/**
 * 「priority:高 tag:仕事,買い物 due:today」のような軽量クエリ文字列を解析する。
 * キーは priority / due / tag / folder。カンマ区切りは OR、キー間は AND。
 */
export function parseQuery(query: string): ParsedQuery {
  const priorities: Priority[] = [];
  const tags: string[] = [];
  let due: DueCond | null = null;
  let folderName: string | null = null;

  const tokens = query.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const m = token.match(/^(priority|due|tag|folder):(.+)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2];

    if (key === "priority") {
      for (const v of value.split(",")) {
        const p = PRIORITY_WORDS[v.trim().toLowerCase()];
        if (p !== undefined && !priorities.includes(p)) priorities.push(p);
      }
    } else if (key === "due") {
      if (DUE_CONDS.includes(value.toLowerCase() as DueCond)) {
        due = value.toLowerCase() as DueCond;
      }
    } else if (key === "tag") {
      for (const v of value.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!tags.includes(v)) tags.push(v);
      }
    } else if (key === "folder") {
      folderName = value.trim() || null;
    }
  }

  return { priorities, tags, due, folderName };
}

export function isEmptyQuery(pq: ParsedQuery): boolean {
  return !pq.priorities.length && !pq.tags.length && !pq.due && !pq.folderName;
}

export function matchTask(
  t: Task,
  pq: ParsedQuery,
  folders: Folder[],
  now: Date = new Date()
): boolean {
  if (pq.priorities.length && !pq.priorities.includes(t.priority)) return false;
  if (pq.tags.length && !pq.tags.some((tag) => t.tags.includes(tag))) return false;

  if (pq.folderName) {
    const ids = folders.filter((f) => f.name === pq.folderName).map((f) => f.id);
    if (!t.folderId || !ids.includes(t.folderId)) return false;
  }

  if (pq.due) {
    const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    const endWeek = new Date(startToday);
    endWeek.setDate(endWeek.getDate() + 7);

    if (pq.due === "none" && due !== null) return false;
    if (pq.due === "today" && !(due !== null && due >= startToday.getTime() && due <= endToday.getTime())) {
      return false;
    }
    if (pq.due === "week" && !(due !== null && due >= startToday.getTime() && due <= endWeek.getTime())) {
      return false;
    }
    if (pq.due === "overdue" && !(due !== null && due < now.getTime() && !t.completed)) {
      return false;
    }
  }

  return true;
}
