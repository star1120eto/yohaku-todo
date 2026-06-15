import type { Repeat } from "./types";

export interface RepeatRule {
  repeat: Exclude<Repeat, null>;
  weekday?: number | null; // 0=日〜6=土
  weekOfMonth?: number | null; // 1〜5、-1=最終
}

/** 指定した年月の「第 nth ◯曜日」の日付を返す(nth=-1 で最終週)。 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number
): Date {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0);
    const back = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - back);
  }
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const result = new Date(year, month, day);
  // 第5週などが存在しない月は、最終の該当曜日にフォールバックする
  if (result.getMonth() !== month) {
    return nthWeekdayOfMonth(year, month, weekday, -1);
  }
  return result;
}

/** 繰り返しタスクの次回日時を返す。now より後になるまで進める。 */
export function nextOccurrence(
  dueAt: Date,
  rule: RepeatRule,
  now: Date = new Date()
): Date {
  let next = new Date(dueAt);
  do {
    if (rule.repeat === "daily") {
      next.setDate(next.getDate() + 1);
    } else if (rule.repeat === "weekly") {
      next.setDate(next.getDate() + 7);
    } else if (
      rule.repeat === "monthly-weekday" &&
      rule.weekday != null &&
      rule.weekOfMonth != null
    ) {
      const base = new Date(next.getFullYear(), next.getMonth() + 1, 1);
      const nd = nthWeekdayOfMonth(
        base.getFullYear(),
        base.getMonth(),
        rule.weekday,
        rule.weekOfMonth
      );
      nd.setHours(next.getHours(), next.getMinutes(), 0, 0);
      next = nd;
    } else {
      next.setMonth(next.getMonth() + 1);
    }
  } while (next <= now);
  return next;
}
