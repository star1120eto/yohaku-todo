import { describe, it, expect } from "vitest";
import {
  parseTickTickCsv,
  serializeTickTickCsv,
  type ExportTask,
} from "@/lib/importExport";

// ユーザーが実際に添付したTickTickエクスポートCSVと同じ形式のサンプル
const SAMPLE_CSV = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
meta,view_style=board,,,,,,,,,,,,,
,,,,,,,,,,,,,,
task,[Example Article](https://example.com/articles/1),,,4,1,Yuta (53193251),,,,Asia/Tokyo,,,,
task,ただのテキストのタスク,,,4,1,Yuta (53193251),,,,Asia/Tokyo,,,,
,,,,,,,,,,,,,,
section,ブックマーク,,False,,,,,,,,,,,
task,[Another Link](https://example.com/articles/2),メモ書き,,4,1,Yuta (53193251),,,,Asia/Tokyo,,,,
,,,,,,,,,,,,,,
`;

describe("parseTickTickCsv", () => {
  it("ヘッダー行・meta行・空行を読み飛ばす", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.tasks).toHaveLength(3);
  });

  it("セクションを持たないタスクはsectionNameがnullになる", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.tasks[0].sectionName).toBeNull();
    expect(plan.tasks[1].sectionName).toBeNull();
  });

  it("section行より後のタスクにはそのセクション名が設定される", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.sections).toEqual(["ブックマーク"]);
    expect(plan.tasks[2].sectionName).toBe("ブックマーク");
  });

  it("[表示名](URL) 形式のMarkdownリンクはタイトルとメモ(URL)に分解する", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.tasks[0].title).toBe("Example Article");
    expect(plan.tasks[0].note).toBe("https://example.com/articles/1");
  });

  it("Markdownリンクでないプレーンなテキストはそのままタイトルになる", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.tasks[1].title).toBe("ただのテキストのタスク");
    expect(plan.tasks[1].note).toBe("");
  });

  it("DESCRIPTION列とURLの両方がある場合はメモに両方含める", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.tasks[2].title).toBe("Another Link");
    expect(plan.tasks[2].note).toBe("メモ書き\nhttps://example.com/articles/2");
  });

  it("サンプルのPRIORITY値(4)は未対応の値としてなし(0)に丸められる", () => {
    const plan = parseTickTickCsv(SAMPLE_CSV);
    expect(plan.tasks.every((t) => t.priority === 0)).toBe(true);
  });

  it("PRIORITY 5/3/1 はそれぞれ高/中/低に変換される", () => {
    const csv = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
task,高,,,5,1,,,,,,,,,
task,中,,,3,1,,,,,,,,,
task,低,,,1,1,,,,,,,,,
`;
    const plan = parseTickTickCsv(csv);
    expect(plan.tasks.map((t) => t.priority)).toEqual([3, 2, 1]);
  });

  it("DATE/DEADLINEが解析可能なISO日時ならdueAt/deadlineAtに変換する", () => {
    const csv = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
task,期日あり,,,0,1,,,2026-08-01T09:00:00.000Z,,,,,2026-08-05T23:59:00.000Z,
`;
    const plan = parseTickTickCsv(csv);
    expect(plan.tasks[0].dueAt).toBe("2026-08-01T09:00:00.000Z");
    expect(plan.tasks[0].deadlineAt).toBe("2026-08-05T23:59:00.000Z");
  });

  it("DATEが空・不正な文字列ならdueAtはnullになる", () => {
    const csv = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
task,期日なし,,,0,1,,,,,,,,,
task,不正な日付,,,0,1,,,not-a-date,,,,,,
`;
    const plan = parseTickTickCsv(csv);
    expect(plan.tasks[0].dueAt).toBeNull();
    expect(plan.tasks[1].dueAt).toBeNull();
  });

  it("DURATIONはHour単位なら分に変換し、5〜1440の範囲にクランプする", () => {
    const csv = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
task,1時間,,,0,1,,,,,,1,Hour,,
task,30分,,,0,1,,,,,,30,Minute,,
task,長すぎる,,,0,1,,,,,,9999,Minute,,
`;
    const plan = parseTickTickCsv(csv);
    expect(plan.tasks[0].durationMinutes).toBe(60);
    expect(plan.tasks[1].durationMinutes).toBe(30);
    expect(plan.tasks[2].durationMinutes).toBe(1440);
  });

  it("INDENTが2以上のサブタスクは1階層に丸めず値をそのまま保持する(呼び出し側で親子付けする)", () => {
    const csv = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
task,親,,,0,1,,,,,,,,,
task,子,,,0,2,,,,,,,,,
`;
    const plan = parseTickTickCsv(csv);
    expect(plan.tasks[0].indent).toBe(1);
    expect(plan.tasks[1].indent).toBe(2);
  });
});

describe("serializeTickTickCsv", () => {
  function makeTask(overrides: Partial<ExportTask> = {}): ExportTask {
    return {
      title: "タスク",
      note: "",
      priority: 0,
      dueAt: null,
      deadlineAt: null,
      durationMinutes: null,
      sectionName: null,
      depth: 0,
      ...overrides,
    };
  }

  it("セクション無しのタスクはセクション行より前に出力される", () => {
    const csv = serializeTickTickCsv([
      makeTask({ title: "直下タスク" }),
      makeTask({ title: "セクション内タスク", sectionName: "作業中" }),
    ]);
    const contentIndex = (needle: string) => csv.split("\r\n").findIndex((l) => l.includes(needle));
    expect(contentIndex("直下タスク")).toBeGreaterThan(0);
    expect(contentIndex("作業中")).toBeGreaterThan(contentIndex("直下タスク"));
    expect(contentIndex("セクション内タスク")).toBeGreaterThan(contentIndex("作業中"));
  });

  it("メモが裸のURL1行だけならMarkdownリンクとして書き出す(取り込みと対称)", () => {
    const csv = serializeTickTickCsv([
      makeTask({ title: "記事", note: "https://example.com/x" }),
    ]);
    expect(csv).toContain("[記事](https://example.com/x)");
  });

  it("メモがURL以外を含む場合はDESCRIPTION列にそのまま書き出す", () => {
    const csv = serializeTickTickCsv([makeTask({ title: "普通のメモ", note: "ただのメモ" })]);
    expect(csv).toContain("普通のメモ,ただのメモ");
  });

  it("優先度はよはくの0〜3からTickTickの0/1/3/5へ変換される", () => {
    const csv = serializeTickTickCsv([
      makeTask({ title: "高", priority: 3 }),
      makeTask({ title: "中", priority: 2 }),
      makeTask({ title: "低", priority: 1 }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines.find((l) => l.startsWith("task,高"))).toContain(",5,");
    expect(lines.find((l) => l.startsWith("task,中"))).toContain(",3,");
    expect(lines.find((l) => l.startsWith("task,低"))).toContain(",1,");
  });

  it("書き出したCSVを再度parseTickTickCsvで読み込むと、タイトル・メモ・セクションが往復する", () => {
    const tasks: ExportTask[] = [
      makeTask({ title: "直下", note: "メモ" }),
      makeTask({ title: "記事", note: "https://example.com/y", sectionName: "資料" }),
    ];
    const csv = serializeTickTickCsv(tasks);
    const reparsed = parseTickTickCsv(csv);
    expect(reparsed.tasks.map((t) => ({ title: t.title, note: t.note, sectionName: t.sectionName }))).toEqual([
      { title: "直下", note: "メモ", sectionName: null },
      { title: "記事", note: "https://example.com/y", sectionName: "資料" },
    ]);
  });
});
