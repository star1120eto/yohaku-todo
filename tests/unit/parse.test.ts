import { describe, it, expect } from "vitest";
import { parseTitle } from "@/lib/parse";
import { DEFAULT_PREFIXES } from "@/lib/types";

// 「タイトルの自動解析」という振る舞いの単位を、本物の parseTitle に対して検証する。
// 時刻に依存する結果を安定させるため now は固定する(2026-06-15 月曜 10:00)。
const NOW = new Date(2026, 5, 15, 10, 0, 0);
const parse = (input: string, prefixes = DEFAULT_PREFIXES) =>
  parseTitle(input, prefixes, NOW);

describe("parseTitle: 接頭語の抽出", () => {
  it("#タグを複数取り出し、本文から取り除く", () => {
    const r = parse("牛乳 #買い物 #食料");
    expect(r.tags).toEqual(["買い物", "食料"]);
    expect(r.title).toBe("牛乳");
  });

  it("!高 を優先度3として読み取る", () => {
    expect(parse("原稿 !高").priority).toBe(3);
    expect(parse("原稿 !中").priority).toBe(2);
    expect(parse("原稿 !低").priority).toBe(1);
  });

  it("Todoist 流の !1 を最優先(3)として読み取る", () => {
    expect(parse("原稿 !1").priority).toBe(3);
    expect(parse("原稿 !3").priority).toBe(1);
  });

  it("英語表記 !high / !low も優先度になる", () => {
    expect(parse("task !high").priority).toBe(3);
    expect(parse("task !low").priority).toBe(1);
  });

  it("優先度語として無効な !xxx は本文に残す", () => {
    const r = parse("原稿 !xxx");
    expect(r.priority).toBe(0);
    expect(r.title).toBe("原稿 !xxx");
  });

  it("@フォルダ名を取り出す", () => {
    const r = parse("資料 @案件A");
    expect(r.folderName).toBe("案件A");
    expect(r.title).toBe("資料");
  });
});

describe("parseTitle: 相対日付", () => {
  it("今日は当日 9:00", () => {
    const r = parse("買い物 今日");
    expect(r.dueAt?.getFullYear()).toBe(2026);
    expect(r.dueAt?.getMonth()).toBe(5);
    expect(r.dueAt?.getDate()).toBe(15);
    expect(r.dueAt?.getHours()).toBe(9);
  });

  it("明日は翌日", () => {
    expect(parse("買い物 明日").dueAt?.getDate()).toBe(16);
  });

  it("明後日は2日後", () => {
    expect(parse("買い物 明後日").dueAt?.getDate()).toBe(17);
  });

  it("来週は7日後", () => {
    expect(parse("買い物 来週").dueAt?.getDate()).toBe(22);
  });
});

describe("parseTitle: 絶対日付・時刻", () => {
  it("6/20 を今年の日付として読む", () => {
    const r = parse("提出 6/20");
    expect(r.dueAt?.getMonth()).toBe(5);
    expect(r.dueAt?.getDate()).toBe(20);
  });

  it("2026-06-15 を ISO 形式で読む", () => {
    const r = parse("提出 2026-06-15");
    expect(r.dueAt?.getFullYear()).toBe(2026);
    expect(r.dueAt?.getMonth()).toBe(5);
    expect(r.dueAt?.getDate()).toBe(15);
  });

  it("15:00 は今より後なので当日に設定する", () => {
    const r = parse("会議 15:00");
    expect(r.dueAt?.getDate()).toBe(15);
    expect(r.dueAt?.getHours()).toBe(15);
    expect(r.dueAt?.getMinutes()).toBe(0);
  });

  it("5時 は今より前なので翌日に繰り越す", () => {
    const r = parse("起床 5時");
    expect(r.dueAt?.getDate()).toBe(16);
    expect(r.dueAt?.getHours()).toBe(5);
  });

  it("15時30分 の分も読み取る", () => {
    const r = parse("会議 15時30分");
    expect(r.dueAt?.getHours()).toBe(15);
    expect(r.dueAt?.getMinutes()).toBe(30);
  });
});

describe("parseTitle: 曜日と繰り返し", () => {
  it("英語 daily を繰り返しとして読む", () => {
    expect(parse("運動 daily").repeat).toBe("daily");
  });

  it("毎日は repeat=daily、起点は翌日(当日9時は過ぎているため)", () => {
    const r = parse("運動 毎日");
    expect(r.repeat).toBe("daily");
    expect(r.dueAt?.getDate()).toBe(16);
    expect(r.dueAt?.getHours()).toBe(9);
  });

  it("毎週土曜5時 を weekly + 土曜 + 5:00 として読む", () => {
    const r = parse("掃除 毎週土曜5時");
    expect(r.repeat).toBe("weekly");
    expect(r.dueAt?.getDay()).toBe(6); // 土曜
    expect(r.dueAt?.getDate()).toBe(20);
    expect(r.dueAt?.getHours()).toBe(5);
  });

  it("毎月第一金曜10時 を monthly-weekday として読む", () => {
    const r = parse("資料提出 毎月第一金曜10時");
    expect(r.repeat).toBe("monthly-weekday");
    expect(r.weekday).toBe(5); // 金曜
    expect(r.weekOfMonth).toBe(1);
    expect(r.dueAt?.getDay()).toBe(5);
    expect(r.dueAt?.getHours()).toBe(10);
  });

  it("毎月最終金曜 を weekOfMonth=-1 として読む", () => {
    const r = parse("締め 毎月最終金曜");
    expect(r.repeat).toBe("monthly-weekday");
    expect(r.weekOfMonth).toBe(-1);
    expect(r.weekday).toBe(5);
  });
});

describe("parseTitle: 複合と設定", () => {
  it("日時・タグ・優先度・フォルダを 1 行から全て取り出す", () => {
    const r = parse("企画書を出す 明日 15:00 #仕事 !高 @案件A");
    expect(r.title).toBe("企画書を出す");
    expect(r.tags).toEqual(["仕事"]);
    expect(r.priority).toBe(3);
    expect(r.folderName).toBe("案件A");
    expect(r.dueAt?.getDate()).toBe(16);
    expect(r.dueAt?.getHours()).toBe(15);
  });

  it("接頭語を変更すると新しい記号で解析する", () => {
    const prefixes = { tag: "/", priority: "*", folder: "+", parseDates: true };
    const r = parse("買い物 /食料 *高 +家事", prefixes);
    expect(r.tags).toEqual(["食料"]);
    expect(r.priority).toBe(3);
    expect(r.folderName).toBe("家事");
    expect(r.title).toBe("買い物");
  });

  it("parseDates=false なら日付は解析せず本文に残す(タグは解析する)", () => {
    const prefixes = { ...DEFAULT_PREFIXES, parseDates: false };
    const r = parse("買い物 明日 #食料", prefixes);
    expect(r.dueAt).toBeNull();
    expect(r.tags).toEqual(["食料"]);
    expect(r.title).toBe("買い物 明日");
  });

  it("該当語がなければ dueAt は null、本文はそのまま", () => {
    const r = parse("ただのメモ");
    expect(r.dueAt).toBeNull();
    expect(r.repeat).toBeNull();
    expect(r.title).toBe("ただのメモ");
  });
});
