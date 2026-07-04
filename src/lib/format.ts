import type { Repeat } from "./types";

export const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

/** 曜日列の色クラス(日曜=赤 / 土曜=青)。 */
export function weekdayColor(dow: number): string {
  if (dow === 0) return "text-danger";
  if (dow === 6) return "text-satblue";
  return "";
}

interface RepeatInfo {
  repeat: Repeat;
  dueAt?: string | Date | null;
  weekday?: number | null;
  weekOfMonth?: number | null;
}

/** 繰り返し設定を「毎週 土曜」「毎月 第1金曜」のような表示にする。 */
export function formatRepeat(t: RepeatInfo): string {
  if (!t.repeat) return "";
  if (t.repeat === "daily") return "毎日";
  if (t.repeat === "weekly") {
    const dow = t.dueAt != null ? new Date(t.dueAt).getDay() : null;
    return dow != null ? `毎週 ${WEEKDAY_JP[dow]}曜` : "毎週";
  }
  if (t.repeat === "monthly") return "毎月";
  // monthly-weekday
  const nth = t.weekOfMonth === -1 ? "最終" : `第${t.weekOfMonth}`;
  const wd = t.weekday != null ? `${WEEKDAY_JP[t.weekday]}曜` : "";
  return `毎月 ${nth}${wd}`;
}

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
  const dow = WEEKDAY_JP[d.getDay()];
  const date = sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}(${dow})`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${dow})`;
  return `${date} ${time}`;
}

export function isOverdue(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() < now.getTime();
}

/** 締切の日付表示(時刻なし)。 */
export function formatDeadline(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 締切の近さに応じた色クラス(超過=赤、3日以内=黄土色)。 */
export function deadlineColor(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff < 0) return "text-danger";
  if (diff < 3 * 86400000) return "text-[#c79a4e]";
  return "";
}

/** datetime-local 入力用 (ローカルタイムの YYYY-MM-DDTHH:mm) */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 検索用に文字列を正規化する(全角/半角ゆらぎ・大小文字を吸収)。 */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

export function matchesQuery(haystacks: string[], query: string): boolean {
  const q = normalizeForSearch(query).trim();
  if (!q) return true;
  return haystacks.some((h) => normalizeForSearch(h).includes(q));
}

/** 「3分前」「昨日」のような相対時刻表示。 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diffSec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 所要時間を「1時間30分」のように表示する。 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
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
