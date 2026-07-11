import { describe, it, expect } from "vitest";
import { parseQuery, isEmptyQuery, matchTask } from "@/lib/filterQuery";
import type { Folder, Task } from "@/lib/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    workspaceId: "w1",
    folderId: null,
    sectionId: null,
    parentId: null,
    title: "タスク",
    note: "",
    completed: false,
    completedAt: null,
    priority: 0,
    tags: [],
    dueAt: null,
    deadlineAt: null,
    reminders: [0],
    repeat: null,
    weekday: null,
    weekOfMonth: null,
    location: null,
    assigneeId: null,
    durationMinutes: null,
    createdBy: "u1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    order: 0,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "f1",
    workspaceId: "w1",
    name: "仕事",
    order: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseQuery", () => {
  it("priority:高 tag:仕事,買い物 due:today のようなキーごとのAND・カンマ区切りORを解析する", () => {
    const pq = parseQuery("priority:高 tag:仕事,買い物 due:today");
    expect(pq.priorities).toEqual([3]);
    expect(pq.tags).toEqual(["仕事", "買い物"]);
    expect(pq.due).toBe("today");
    expect(pq.folderName).toBeNull();
  });

  it("folder:仕事 を解析する", () => {
    const pq = parseQuery("folder:仕事");
    expect(pq.folderName).toBe("仕事");
  });

  it("priority の英語表記・数字表記も解釈する", () => {
    expect(parseQuery("priority:high").priorities).toEqual([3]);
    expect(parseQuery("priority:medium").priorities).toEqual([2]);
    expect(parseQuery("priority:1").priorities).toEqual([3]);
  });

  it("同じ優先度が複数回指定されても重複しない", () => {
    expect(parseQuery("priority:高,高,high").priorities).toEqual([3]);
  });

  it("不明なキーや値は無視する", () => {
    const pq = parseQuery("unknown:foo due:someday priority:超高");
    expect(pq.due).toBeNull();
    expect(pq.priorities).toEqual([]);
  });

  it("空文字列は全て空の結果になる", () => {
    const pq = parseQuery("   ");
    expect(pq.priorities).toEqual([]);
    expect(pq.tags).toEqual([]);
    expect(pq.due).toBeNull();
    expect(pq.folderName).toBeNull();
  });
});

describe("isEmptyQuery", () => {
  it("何も条件が無ければ true", () => {
    expect(isEmptyQuery(parseQuery(""))).toBe(true);
  });

  it("1つでも条件があれば false", () => {
    expect(isEmptyQuery(parseQuery("priority:高"))).toBe(false);
    expect(isEmptyQuery(parseQuery("tag:仕事"))).toBe(false);
    expect(isEmptyQuery(parseQuery("due:today"))).toBe(false);
    expect(isEmptyQuery(parseQuery("folder:仕事"))).toBe(false);
  });
});

describe("matchTask", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("priority条件に一致しないタスクは除外する", () => {
    const pq = parseQuery("priority:高");
    expect(matchTask(makeTask({ priority: 3 }), pq, [], now)).toBe(true);
    expect(matchTask(makeTask({ priority: 1 }), pq, [], now)).toBe(false);
  });

  it("tag条件はOR一致(いずれかのタグを含めば一致)", () => {
    const pq = parseQuery("tag:仕事,買い物");
    expect(matchTask(makeTask({ tags: ["買い物"] }), pq, [], now)).toBe(true);
    expect(matchTask(makeTask({ tags: ["趣味"] }), pq, [], now)).toBe(false);
  });

  it("folder条件は名前が一致するフォルダIDを持つタスクのみ一致する", () => {
    const folders = [makeFolder({ id: "f1", name: "仕事" }), makeFolder({ id: "f2", name: "個人" })];
    const pq = parseQuery("folder:仕事");
    expect(matchTask(makeTask({ folderId: "f1" }), pq, folders, now)).toBe(true);
    expect(matchTask(makeTask({ folderId: "f2" }), pq, folders, now)).toBe(false);
    expect(matchTask(makeTask({ folderId: null }), pq, folders, now)).toBe(false);
  });

  it("due:today は今日の期日のみ一致する", () => {
    const pq = parseQuery("due:today");
    expect(matchTask(makeTask({ dueAt: "2026-06-15T23:00:00.000Z" }), pq, [], now)).toBe(true);
    expect(matchTask(makeTask({ dueAt: "2026-06-16T01:00:00.000Z" }), pq, [], now)).toBe(false);
    expect(matchTask(makeTask({ dueAt: null }), pq, [], now)).toBe(false);
  });

  it("due:week は今日から1週間以内の期日に一致する", () => {
    const pq = parseQuery("due:week");
    expect(matchTask(makeTask({ dueAt: "2026-06-20T00:00:00.000Z" }), pq, [], now)).toBe(true);
    expect(matchTask(makeTask({ dueAt: "2026-06-25T00:00:00.000Z" }), pq, [], now)).toBe(false);
  });

  it("due:overdue は未完了かつ過去の期日のみ一致する", () => {
    const pq = parseQuery("due:overdue");
    expect(matchTask(makeTask({ dueAt: "2026-06-10T00:00:00.000Z", completed: false }), pq, [], now)).toBe(true);
    expect(
      matchTask(makeTask({ dueAt: "2026-06-10T00:00:00.000Z", completed: true }), pq, [], now)
    ).toBe(false);
    expect(matchTask(makeTask({ dueAt: "2026-06-20T00:00:00.000Z" }), pq, [], now)).toBe(false);
  });

  it("due:none は期日未設定のタスクのみ一致する", () => {
    const pq = parseQuery("due:none");
    expect(matchTask(makeTask({ dueAt: null }), pq, [], now)).toBe(true);
    expect(matchTask(makeTask({ dueAt: "2026-06-15T00:00:00.000Z" }), pq, [], now)).toBe(false);
  });

  it("複数条件はAND(全て満たす必要がある)", () => {
    const pq = parseQuery("priority:高 tag:仕事");
    expect(matchTask(makeTask({ priority: 3, tags: ["仕事"] }), pq, [], now)).toBe(true);
    expect(matchTask(makeTask({ priority: 3, tags: ["買い物"] }), pq, [], now)).toBe(false);
    expect(matchTask(makeTask({ priority: 1, tags: ["仕事"] }), pq, [], now)).toBe(false);
  });
});
