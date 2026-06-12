import type { Repeat } from "./types";

/** 繰り返しタスクの次回日時を返す。now より後になるまで進める。 */
export function nextOccurrence(
  dueAt: Date,
  repeat: Exclude<Repeat, null>,
  now: Date = new Date()
): Date {
  const next = new Date(dueAt);
  do {
    if (repeat === "daily") {
      next.setDate(next.getDate() + 1);
    } else if (repeat === "weekly") {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
  } while (next <= now);
  return next;
}
