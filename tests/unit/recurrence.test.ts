import { describe, it, expect } from "vitest";
import { nthWeekdayOfMonth, nextOccurrence } from "@/lib/recurrence";

describe("nthWeekdayOfMonth", () => {
  it("2026年6月の第1金曜は 6/5", () => {
    const d = nthWeekdayOfMonth(2026, 5, 5, 1);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(5);
    expect(d.getDay()).toBe(5);
  });

  it("第N(-1)で最終◯曜を返す: 2026年6月の最終金曜は 6/26", () => {
    const d = nthWeekdayOfMonth(2026, 5, 5, -1);
    expect(d.getDate()).toBe(26);
    expect(d.getDay()).toBe(5);
  });

  it("存在しない第5週は最終◯曜へフォールバックし、月をはみ出さない", () => {
    // 2026年2月(28日)に第5月曜は存在しない
    const d = nthWeekdayOfMonth(2026, 1, 1, 5);
    expect(d.getMonth()).toBe(1); // 2月のまま
    expect(d.getDay()).toBe(1); // 月曜
  });
});

describe("nextOccurrence", () => {
  it("daily: now を超えるまで日単位で進める", () => {
    const due = new Date(2026, 5, 15, 9, 0, 0);
    const now = new Date(2026, 5, 17, 12, 0, 0);
    const next = nextOccurrence(due, { repeat: "daily" }, now);
    expect(next.getDate()).toBe(18);
    expect(next.getHours()).toBe(9);
  });

  it("daily: now がずっと先でも一気に追い越す", () => {
    const due = new Date(2026, 5, 1, 8, 0, 0);
    const now = new Date(2026, 5, 20, 0, 0, 0);
    const next = nextOccurrence(due, { repeat: "daily" }, now);
    expect(next.getDate()).toBe(20);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("weekly: 7日後の同じ曜日に進める", () => {
    const due = new Date(2026, 5, 15, 9, 0, 0); // 月曜
    const now = new Date(2026, 5, 20, 0, 0, 0);
    const next = nextOccurrence(due, { repeat: "weekly" }, now);
    expect(next.getDate()).toBe(22);
    expect(next.getDay()).toBe(1);
  });

  it("monthly: 翌月の同じ日に進める", () => {
    const due = new Date(2026, 5, 15, 9, 0, 0);
    const now = new Date(2026, 5, 20, 0, 0, 0);
    const next = nextOccurrence(due, { repeat: "monthly" }, now);
    expect(next.getMonth()).toBe(6); // 7月
    expect(next.getDate()).toBe(15);
  });

  it("monthly-weekday: 翌月の第N◯曜へ進め、時刻を保つ", () => {
    const due = new Date(2026, 5, 5, 9, 30, 0); // 6月の第1金曜
    const now = new Date(2026, 5, 10, 0, 0, 0);
    const next = nextOccurrence(
      due,
      { repeat: "monthly-weekday", weekday: 5, weekOfMonth: 1 },
      now
    );
    expect(next.getMonth()).toBe(6); // 7月
    expect(next.getDate()).toBe(3); // 7月の第1金曜
    expect(next.getDay()).toBe(5);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });
});
