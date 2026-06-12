import type { Repeat } from "./types";

export const REPEAT_LABELS: Record<Exclude<Repeat, null>, string> = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};

export function formatDue(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (diffDays === 0) return `今日 ${time}`;
  if (diffDays === 1) return `明日 ${time}`;
  if (diffDays === -1) return `昨日 ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return `${date} ${time}`;
}

export function isOverdue(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() < now.getTime();
}

/** datetime-local 入力用 (ローカルタイムの YYYY-MM-DDTHH:mm) */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
