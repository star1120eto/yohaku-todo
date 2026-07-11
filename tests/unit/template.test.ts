import { describe, it, expect } from "vitest";
import { resolveDueAt, toRelative } from "@/lib/template";
import type { TemplateItem } from "@/lib/types";

function makeItem(overrides: Partial<TemplateItem> = {}): TemplateItem {
  return {
    title: "タスク",
    note: "",
    priority: 0,
    tags: [],
    relDays: null,
    time: null,
    repeat: null,
    weekday: null,
    weekOfMonth: null,
    parentIndex: null,
    ...overrides,
  };
}

describe("resolveDueAt", () => {
  const now = new Date("2026-06-15T04:00:00.000Z");

  it("relDaysがnullなら期日なし(null)を返す", () => {
    expect(resolveDueAt(makeItem({ relDays: null }), now)).toBeNull();
  });

  it("relDays分だけ日付を進め、timeが無ければ9時にする", () => {
    const result = resolveDueAt(makeItem({ relDays: 1, time: null }), now);
    expect(result).toBe("2026-06-16T09:00:00.000Z");
  });

  it("relDays:0は当日を指す", () => {
    const result = resolveDueAt(makeItem({ relDays: 0, time: "14:30" }), now);
    expect(result).toBe("2026-06-15T14:30:00.000Z");
  });

  it("timeが指定されていればその時刻を使う", () => {
    const result = resolveDueAt(makeItem({ relDays: 3, time: "08:05" }), now);
    expect(result).toBe("2026-06-18T08:05:00.000Z");
  });

  it("月をまたぐ相対日数も正しく計算する", () => {
    const result = resolveDueAt(makeItem({ relDays: 20, time: "00:00" }), now);
    expect(result).toBe("2026-07-05T00:00:00.000Z");
  });
});

describe("toRelative", () => {
  const now = new Date("2026-06-15T04:00:00.000Z");

  it("dueAtがnullならrelDays/timeともにnullを返す", () => {
    expect(toRelative(null, now)).toEqual({ relDays: null, time: null });
  });

  it("同じ日の期日はrelDays:0になる", () => {
    expect(toRelative("2026-06-15T14:30:00.000Z", now)).toEqual({
      relDays: 0,
      time: "14:30",
    });
  });

  it("翌日の期日はrelDays:1になる", () => {
    expect(toRelative("2026-06-16T09:00:00.000Z", now)).toEqual({
      relDays: 1,
      time: "09:00",
    });
  });

  it("過去の期日はrelDaysが負にならず0にクランプされる", () => {
    expect(toRelative("2026-06-10T09:00:00.000Z", now)).toEqual({
      relDays: 0,
      time: "09:00",
    });
  });

  it("resolveDueAtとtoRelativeは往復して同じ日時に戻る", () => {
    const original = "2026-06-20T13:45:00.000Z";
    const rel = toRelative(original, now);
    const restored = resolveDueAt(
      { ...makeItem(), relDays: rel.relDays, time: rel.time },
      now
    );
    expect(restored).toBe(original);
  });
});
