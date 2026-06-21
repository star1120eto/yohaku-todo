import { describe, it, expect } from "vitest";
import {
  weekdayColor,
  formatRepeat,
  formatDue,
  isOverdue,
  toLocalInputValue,
  distanceMeters,
} from "@/lib/format";

describe("weekdayColor", () => {
  it("日曜は赤、土曜は青、平日は無色", () => {
    expect(weekdayColor(0)).toBe("text-danger");
    expect(weekdayColor(6)).toBe("text-satblue");
    expect(weekdayColor(3)).toBe("");
  });
});

describe("formatRepeat", () => {
  it("daily / monthly はそのまま日本語化する", () => {
    expect(formatRepeat({ repeat: "daily" })).toBe("毎日");
    expect(formatRepeat({ repeat: "monthly" })).toBe("毎月");
  });

  it("weekly は dueAt の曜日を付ける", () => {
    const sat = new Date(2026, 5, 20); // 土曜
    expect(formatRepeat({ repeat: "weekly", dueAt: sat })).toBe("毎週 土曜");
  });

  it("monthly-weekday は第N◯曜・最終◯曜を表示する", () => {
    expect(
      formatRepeat({ repeat: "monthly-weekday", weekday: 5, weekOfMonth: 1 })
    ).toBe("毎月 第1金曜");
    expect(
      formatRepeat({ repeat: "monthly-weekday", weekday: 5, weekOfMonth: -1 })
    ).toBe("毎月 最終金曜");
  });

  it("repeat が無ければ空文字", () => {
    expect(formatRepeat({ repeat: null })).toBe("");
  });
});

describe("formatDue", () => {
  const now = new Date(2026, 5, 15, 10, 0, 0);

  it("当日は「今日 H:mm」", () => {
    const iso = new Date(2026, 5, 15, 15, 5).toISOString();
    expect(formatDue(iso, now)).toBe("今日 15:05");
  });

  it("翌日は「明日」、前日は「昨日」", () => {
    expect(formatDue(new Date(2026, 5, 16, 9, 0).toISOString(), now)).toBe(
      "明日 9:00"
    );
    expect(formatDue(new Date(2026, 5, 14, 9, 0).toISOString(), now)).toBe(
      "昨日 9:00"
    );
  });

  it("同年の他日は「M/D(曜) H:mm」", () => {
    const iso = new Date(2026, 5, 20, 8, 30).toISOString();
    expect(formatDue(iso, now)).toBe("6/20(土) 8:30");
  });

  it("他年は年も含める", () => {
    const iso = new Date(2027, 0, 1, 0, 0).toISOString();
    expect(formatDue(iso, now)).toBe("2027/1/1(金) 0:00");
  });
});

describe("isOverdue", () => {
  const now = new Date(2026, 5, 15, 10, 0, 0);
  it("過去は期限切れ、未来はそうでない", () => {
    expect(isOverdue(new Date(2026, 5, 15, 9, 0).toISOString(), now)).toBe(true);
    expect(isOverdue(new Date(2026, 5, 15, 11, 0).toISOString(), now)).toBe(
      false
    );
  });
});

describe("toLocalInputValue", () => {
  it("datetime-local 入力用にゼロ埋めしたローカル時刻を返す", () => {
    const iso = new Date(2026, 5, 9, 7, 5).toISOString();
    expect(toLocalInputValue(iso)).toBe("2026-06-09T07:05");
  });
});

describe("distanceMeters", () => {
  it("同一地点は 0m", () => {
    expect(distanceMeters(35.0, 139.0, 35.0, 139.0)).toBeCloseTo(0, 5);
  });

  it("赤道上の経度1度差は約111km", () => {
    const d = distanceMeters(0, 0, 0, 1);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});
