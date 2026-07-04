import type { TemplateItem } from "./types";

/** テンプレート項目の相対日付を、生成時刻を基準にした実際の日時へ解決する。 */
export function resolveDueAt(item: TemplateItem, now: Date): string | null {
  if (item.relDays === null) return null;
  const d = new Date(now);
  d.setDate(d.getDate() + item.relDays);
  if (item.time) {
    const [h, m] = item.time.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** タスクの現在の期日から、テンプレート用の相対日数・時刻を作る。 */
export function toRelative(
  dueAt: string | null,
  now: Date
): { relDays: number | null; time: string | null } {
  if (!dueAt) return { relDays: null, time: null };
  const due = new Date(dueAt);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);
  const relDays = Math.max(
    0,
    Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000)
  );
  const time = `${pad(due.getHours())}:${pad(due.getMinutes())}`;
  return { relDays, time };
}
