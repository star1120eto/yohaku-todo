import type { ParsePrefixes, Priority, Repeat } from "./types";

export interface ParsedTitle {
  title: string;
  tags: string[];
  priority: Priority;
  folderName: string | null;
  dueAt: Date | null;
  repeat: Repeat;
  matched: string[]; // 解析で取り除かれたトークン(プレビュー表示用)
}

const PRIORITY_WORDS: Record<string, Priority> = {
  "高": 3, "中": 2, "低": 1,
  high: 3, med: 2, medium: 2, low: 1,
  "1": 3, "2": 2, "3": 1, // Todoist 流: !1 が最優先
};

const REPEAT_WORDS: Record<string, Exclude<Repeat, null>> = {
  "毎日": "daily", daily: "daily",
  "毎週": "weekly", weekly: "weekly",
  "毎月": "monthly", monthly: "monthly",
};

const WEEKDAYS: Record<string, number> = {
  "日曜": 0, "月曜": 1, "火曜": 2, "水曜": 3, "木曜": 4, "金曜": 5, "土曜": 6,
};

const DEFAULT_HOUR = 9;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * タイトル文字列から接頭語付きトークンと日時表現を抜き出す。
 * 例: 「企画書を出す 明日 15:00 #仕事 !高 @案件A 毎週」
 */
export function parseTitle(
  input: string,
  prefixes: ParsePrefixes,
  now: Date = new Date()
): ParsedTitle {
  const tags: string[] = [];
  let priority: Priority = 0;
  let folderName: string | null = null;
  let repeat: Repeat = null;
  const matched: string[] = [];

  let date: { y: number; m: number; d: number } | null = null;
  let time: { h: number; min: number } | null = null;
  let dayOffset: number | null = null;
  let weekday: number | null = null;

  const tokens = input.split(/\s+/).filter(Boolean);
  const rest: string[] = [];

  const tagRe = new RegExp(`^${escapeRe(prefixes.tag)}(.+)$`);
  const priRe = new RegExp(`^${escapeRe(prefixes.priority)}(.+)$`);
  const folderRe = new RegExp(`^${escapeRe(prefixes.folder)}(.+)$`);

  for (const token of tokens) {
    let m: RegExpMatchArray | null;

    if ((m = token.match(tagRe))) {
      tags.push(m[1]);
      matched.push(token);
      continue;
    }
    if ((m = token.match(priRe)) && PRIORITY_WORDS[m[1].toLowerCase()] !== undefined) {
      priority = PRIORITY_WORDS[m[1].toLowerCase()];
      matched.push(token);
      continue;
    }
    if ((m = token.match(folderRe))) {
      folderName = m[1];
      matched.push(token);
      continue;
    }

    if (prefixes.parseDates) {
      const lower = token.toLowerCase();

      if (REPEAT_WORDS[lower]) {
        repeat = REPEAT_WORDS[lower];
        matched.push(token);
        continue;
      }
      if (token === "今日") { dayOffset = 0; matched.push(token); continue; }
      if (token === "明日") { dayOffset = 1; matched.push(token); continue; }
      if (token === "明後日") { dayOffset = 2; matched.push(token); continue; }
      if (token === "来週") { dayOffset = 7; matched.push(token); continue; }

      const wd = Object.keys(WEEKDAYS).find((w) => token.startsWith(w));
      if (wd) { weekday = WEEKDAYS[wd]; matched.push(token); continue; }

      // 2026-06-15 / 2026/6/15
      if ((m = token.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) {
        date = { y: +m[1], m: +m[2], d: +m[3] };
        matched.push(token);
        continue;
      }
      // 6/15
      if ((m = token.match(/^(\d{1,2})\/(\d{1,2})$/))) {
        date = { y: now.getFullYear(), m: +m[1], d: +m[2] };
        matched.push(token);
        continue;
      }
      // 15:00
      if ((m = token.match(/^(\d{1,2}):(\d{2})$/))) {
        time = { h: +m[1], min: +m[2] };
        matched.push(token);
        continue;
      }
      // 15時 / 15時30分
      if ((m = token.match(/^(\d{1,2})時(?:(\d{1,2})分)?$/))) {
        time = { h: +m[1], min: m[2] ? +m[2] : 0 };
        matched.push(token);
        continue;
      }
    }

    rest.push(token);
  }

  let dueAt: Date | null = null;
  if (date || dayOffset !== null || weekday !== null || time) {
    const d = new Date(now);
    d.setSeconds(0, 0);
    if (date) {
      d.setFullYear(date.y, date.m - 1, date.d);
      // 年なし指定(6/15 等)が過去日なら来年とみなす
      if (!time && d < now && date.y === now.getFullYear()) {
        const sameDay =
          d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        if (!sameDay) d.setFullYear(d.getFullYear() + 1);
      }
    } else if (dayOffset !== null) {
      d.setDate(d.getDate() + dayOffset);
    } else if (weekday !== null) {
      const diff = (weekday - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
    }
    if (time) {
      d.setHours(time.h, time.min, 0, 0);
      // 時刻のみ指定で既に過ぎていれば翌日
      if (!date && dayOffset === null && weekday === null && d <= now) {
        d.setDate(d.getDate() + 1);
      }
    } else {
      d.setHours(DEFAULT_HOUR, 0, 0, 0);
    }
    dueAt = d;
  }

  // 繰り返しのみ指定された場合は今日(または明日)を起点にする
  if (repeat && !dueAt) {
    const d = new Date(now);
    d.setHours(DEFAULT_HOUR, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    dueAt = d;
  }

  return {
    title: rest.join(" "),
    tags,
    priority,
    folderName,
    dueAt,
    repeat,
    matched,
  };
}
