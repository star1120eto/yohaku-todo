import { parseCsv, toCsv } from "./csv";
import type { Priority } from "./types";

// TickTick の「リストをCSVでエクスポート」形式の列順。
// https://ticktick.com/ からエクスポートしたCSVはこの列構成になる。
export const TICKTICK_HEADER = [
  "TYPE",
  "CONTENT",
  "DESCRIPTION",
  "IS_COLLAPSED",
  "PRIORITY",
  "INDENT",
  "AUTHOR",
  "RESPONSIBLE",
  "DATE",
  "DATE_LANG",
  "TIMEZONE",
  "DURATION",
  "DURATION_UNIT",
  "DEADLINE",
  "DEADLINE_LANG",
];

const COL = {
  TYPE: 0,
  CONTENT: 1,
  DESCRIPTION: 2,
  PRIORITY: 4,
  INDENT: 5,
  DATE: 8,
  DURATION: 11,
  DURATION_UNIT: 12,
  DEADLINE: 13,
} as const;

export interface ImportedTask {
  title: string;
  note: string;
  priority: Priority;
  dueAt: string | null;
  deadlineAt: string | null;
  durationMinutes: number | null;
  indent: number; // 1が最上位。2以上はサブタスク(1階層に丸める)
  sectionName: string | null; // null はセクション無し(フォルダ直下)
}

export interface ImportPlan {
  sections: string[]; // 出現順・重複無し
  tasks: ImportedTask[];
}

// TickTickの優先度(0/1/3/5)を、よはくの優先度(0〜3)に変換する。
// それ以外の値(未使用・不明な値)は「なし」として安全側に倒す。
const PRIORITY_FROM_TICKTICK: Record<string, Priority> = {
  "5": 3,
  "3": 2,
  "1": 1,
};

const PRIORITY_TO_TICKTICK: Record<Priority, string> = {
  0: "0",
  1: "1",
  2: "3",
  3: "5",
};

function toPriority(v: string): Priority {
  return PRIORITY_FROM_TICKTICK[v.trim()] ?? 0;
}

// "[表示名](https://example.com)" 単体だけの内容を、タイトルとURLに分解する。
// ブックマーク用のリストをMarkdownリンクとして書き出すサービスからの取り込みを想定している。
const MARKDOWN_LINK = /^\[(.+)\]\((https?:\/\/[^\s)]+)\)$/;

function splitTitleAndUrl(content: string): { title: string; url: string | null } {
  const m = content.match(MARKDOWN_LINK);
  if (!m) return { title: content, url: null };
  return { title: m[1], url: m[2] };
}

function toIsoOrNull(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDurationMinutes(value: string | undefined, unit: string | undefined): number | null {
  const n = Number(value);
  if (!value || !value.trim() || Number.isNaN(n) || n <= 0) return null;
  const minutes = /hour/i.test(unit ?? "") ? Math.round(n * 60) : Math.round(n);
  return Math.min(1440, Math.max(5, minutes));
}

/**
 * TickTickのリストCSVエクスポート形式を解析する。
 * ヘッダー行・meta行(view_style=board等)は読み飛ばし、task/section行だけを取り出す。
 * INDENT>=2 は1階層のサブタスクとして扱う(よはくは1階層のみ対応のため)。
 */
export function parseTickTickCsv(text: string): ImportPlan {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  const sections: string[] = [];
  const tasks: ImportedTask[] = [];
  let currentSection: string | null = null;

  for (const row of rows) {
    const type = row[COL.TYPE];
    if (type === "TYPE" || type === "meta") continue;

    if (type === "section") {
      currentSection = (row[COL.CONTENT] ?? "").trim() || "セクション";
      if (!sections.includes(currentSection)) sections.push(currentSection);
      continue;
    }
    if (type !== "task") continue;

    const { title, url } = splitTitleAndUrl((row[COL.CONTENT] ?? "").trim());
    if (!title) continue;
    const description = (row[COL.DESCRIPTION] ?? "").trim();
    const note = [description, url].filter(Boolean).join("\n");

    tasks.push({
      title,
      note,
      priority: toPriority(row[COL.PRIORITY] ?? ""),
      dueAt: toIsoOrNull(row[COL.DATE]),
      deadlineAt: toIsoOrNull(row[COL.DEADLINE]),
      durationMinutes: toDurationMinutes(row[COL.DURATION], row[COL.DURATION_UNIT]),
      indent: Math.max(1, Number(row[COL.INDENT]) || 1),
      sectionName: currentSection,
    });
  }

  return { sections, tasks };
}

export interface ExportTask {
  title: string;
  note: string;
  priority: Priority;
  dueAt: string | null;
  deadlineAt: string | null;
  durationMinutes: number | null;
  sectionName: string | null;
  depth: 0 | 1;
}

const EMPTY_ROW = () => Array(TICKTICK_HEADER.length).fill("");

function taskRow(t: ExportTask): string[] {
  // メモが「1行だけの裸のURL」ならMarkdownリンクとして書き出し、取り込み側と対称にする。
  const bareUrl = /^https?:\/\/\S+$/.test(t.note.trim()) ? t.note.trim() : null;
  const content = bareUrl ? `[${t.title}](${bareUrl})` : t.title;
  const description = bareUrl ? "" : t.note;

  const row = EMPTY_ROW();
  row[COL.TYPE] = "task";
  row[COL.CONTENT] = content;
  row[COL.DESCRIPTION] = description;
  row[COL.PRIORITY] = PRIORITY_TO_TICKTICK[t.priority];
  row[COL.INDENT] = String(t.depth + 1);
  row[COL.DATE] = t.dueAt ?? "";
  row[COL.DURATION] = t.durationMinutes ? String(t.durationMinutes) : "";
  row[COL.DURATION_UNIT] = t.durationMinutes ? "Minute" : "";
  row[COL.DEADLINE] = t.deadlineAt ?? "";
  return row;
}

/** よはくのタスク一覧(フォルダ単位)を、TickTick互換のCSVへ書き出す。 */
export function serializeTickTickCsv(tasks: ExportTask[]): string {
  const rows: string[][] = [TICKTICK_HEADER];
  const meta = EMPTY_ROW();
  meta[COL.TYPE] = "meta";
  meta[COL.CONTENT] = "view_style=list";
  rows.push(meta);
  rows.push(EMPTY_ROW());

  const noSection = tasks.filter((t) => !t.sectionName);
  for (const t of noSection) rows.push(taskRow(t));
  if (noSection.length) rows.push(EMPTY_ROW());

  const sectionNames = [
    ...new Set(tasks.filter((t) => t.sectionName).map((t) => t.sectionName as string)),
  ];
  for (const name of sectionNames) {
    const section = EMPTY_ROW();
    section[COL.TYPE] = "section";
    section[COL.CONTENT] = name;
    rows.push(section);
    for (const t of tasks.filter((x) => x.sectionName === name)) rows.push(taskRow(t));
    rows.push(EMPTY_ROW());
  }

  return toCsv(rows);
}
