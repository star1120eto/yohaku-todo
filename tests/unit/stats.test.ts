import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/stats";

function completion(iso: string) {
  return { completedAt: iso };
}

describe("computeStats", () => {
  it("完了記録が無ければ全て0になる", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const result = computeStats([], now, 0, 7);
    expect(result.todayCount).toBe(0);
    expect(result.weekCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.streak).toBe(0);
    expect(result.bestStreak).toBe(0);
    expect(result.daily).toHaveLength(7);
    expect(result.daily.every((d) => d.count === 0)).toBe(true);
  });

  it("今日完了したタスクがあればtodayCount/streak/bestStreakが1になる", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const result = computeStats([completion("2026-06-15T03:00:00.000Z")], now, 0, 7);
    expect(result.todayCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.streak).toBe(1);
    expect(result.bestStreak).toBe(1);
    expect(result.daily.at(-1)).toEqual({ date: "2026-06-15", count: 1 });
  });

  it("3日連続で完了していればstreak/bestStreakは3になる", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const result = computeStats(
      [
        completion("2026-06-13T10:00:00.000Z"),
        completion("2026-06-14T10:00:00.000Z"),
        completion("2026-06-15T10:00:00.000Z"),
      ],
      now,
      0,
      7
    );
    expect(result.streak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });

  it("途中に抜けがある場合はstreakは直近の連続日数のみを数える", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    // 06-13 は完了しているが 06-14 は完了していないので、直近の連続は今日1日だけ
    const result = computeStats(
      [completion("2026-06-13T10:00:00.000Z"), completion("2026-06-15T10:00:00.000Z")],
      now,
      0,
      7
    );
    expect(result.streak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("今日は未完了でも昨日完了していればstreakは途切れていない扱いになる", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const result = computeStats([completion("2026-06-14T10:00:00.000Z")], now, 0, 7);
    expect(result.streak).toBe(1);
  });

  it("過去に長い連続記録があればbestStreakは現在のstreakより大きくなり得る", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    const result = computeStats(
      [
        completion("2026-06-10T10:00:00.000Z"),
        completion("2026-06-11T10:00:00.000Z"),
        completion("2026-06-12T10:00:00.000Z"),
        completion("2026-06-13T10:00:00.000Z"),
        completion("2026-06-20T10:00:00.000Z"), // 今日は単発
      ],
      now,
      0,
      30
    );
    expect(result.streak).toBe(1);
    expect(result.bestStreak).toBe(4);
  });

  it("tzOffsetMinにより日付境界がローカルタイムゾーンで判定される", () => {
    // UTC 23:30 は JST(+540分)では翌日の 08:30 になる
    const now = new Date("2026-06-16T00:00:00.000Z");
    const resultJst = computeStats(
      [completion("2026-06-15T23:30:00.000Z")],
      now,
      540,
      7
    );
    expect(resultJst.todayCount).toBe(1);

    const resultUtc = computeStats(
      [completion("2026-06-15T23:30:00.000Z")],
      now,
      0,
      7
    );
    expect(resultUtc.todayCount).toBe(0);
  });

  it("weekCountはdaily配列の直近7日分のみを合計する(daysが7より大きい場合)", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const result = computeStats(
      [
        completion("2026-06-06T10:00:00.000Z"),
        completion("2026-06-06T11:00:00.000Z"),
        completion("2026-06-06T12:00:00.000Z"),
        completion("2026-06-06T13:00:00.000Z"),
        completion("2026-06-06T14:00:00.000Z"),
        completion("2026-06-15T10:00:00.000Z"),
        completion("2026-06-15T11:00:00.000Z"),
      ],
      now,
      0,
      10
    );
    expect(result.totalCount).toBe(7);
    expect(result.daily).toHaveLength(10);
    expect(result.weekCount).toBe(2);
    expect(result.daily[0]).toEqual({ date: "2026-06-06", count: 5 });
  });
});
