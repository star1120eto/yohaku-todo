import type { ParsePrefixes, Priority, Repeat } from "./types";
import { nthWeekdayOfMonth } from "./recurrence";

export interface ParsedTitle {
  title: string;
  tags: string[];
  priority: Priority;
  folderName: string | null;
  dueAt: Date | null;
  repeat: Repeat;
  weekday: number | null;
  weekOfMonth: number | null;
  durationMinutes: number | null;
  matched: string[]; // 解析で取り除かれたトークン(プレビュー表示用)
}

// 30分 / 2時間 / 2時間30分 → 所要時間(分)
const DURATION_RE = /^(?:(\d{1,3})時間)?(?:(\d{1,3})分)?$/;

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

const WEEKDAY_INDEX: Record<string, number> = {
  "日": 0, "月": 1, "火": 2, "水": 3, "木": 4, "金": 5, "土": 6,
};

const NTH_WORDS: Record<string, number> = {
  "第一": 1, "第二": 2, "第三": 3, "第四": 4, "第五": 5,
  "第1": 1, "第2": 2, "第3": 3, "第4": 4, "第5": 5,
  "最終": -1, "最後": -1,
};

const DEFAULT_HOUR = 9;

// 「毎週土曜5時」「毎月第一金曜10時」「土曜日」などを 1 トークンから読み取る
const SCHEDULE_RE =
  /^(毎日|毎週|毎月)?(第[一二三四五1-5]|最終|最後)?([日月火水木金土]曜日?)?(?:(\d{1,2}):(\d{2})|(\d{1,2})時(?:(\d{1,2})分)?)?$/;

interface Schedule {
  repeat: Exclude<Repeat, null> | null;
  weekday: number | null;
  weekOfMonth: number | null;
  time: { h: number; min: number } | null;
}

function matchSchedule(token: string): Schedule | null {
  const m = token.match(SCHEDULE_RE);
  if (!m) return null;
  const [, rep, nth, wd, h1, m1, h2, m2] = m;
  if (!rep && !nth && !wd && h1 === undefined && h2 === undefined) return null;
  return {
    repeat: rep ? REPEAT_WORDS[rep] : null,
    weekday: wd ? WEEKDAY_INDEX[wd[0]] : null,
    weekOfMonth: nth ? NTH_WORDS[nth] : null,
    time:
      h1 !== undefined
        ? { h: +h1, min: +m1 }
        : h2 !== undefined
          ? { h: +h2, min: m2 ? +m2 : 0 }
          : null,
  };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * タイトル文字列から接頭語付きトークンと日時表現を抜き出す。
 * 例: 「企画書を出す 明日 15:00 #仕事 !高 @案件A 毎週土曜」
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
  let weekOfMonth: number | null = null;
  let durationMinutes: number | null = null;

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

      if (REPEAT_WORDS[lower] && /^[a-z]+$/i.test(token)) {
        // 英語の daily/weekly/monthly(日本語の 毎週 等は matchSchedule で処理)
        repeat = REPEAT_WORDS[lower];
        matched.push(token);
        continue;
      }
      if (token === "今日") { dayOffset = 0; matched.push(token); continue; }
      if (token === "明日") { dayOffset = 1; matched.push(token); continue; }
      if (token === "明後日") { dayOffset = 2; matched.push(token); continue; }
      if (token === "来週") { dayOffset = 7; matched.push(token); continue; }

      // 繰り返し・曜日・第N週・時刻のまとまり(毎週土曜5時 など)
      const sched = matchSchedule(token);
      if (sched) {
        if (sched.repeat) repeat = sched.repeat;
        if (sched.weekday !== null) weekday = sched.weekday;
        if (sched.weekOfMonth !== null) weekOfMonth = sched.weekOfMonth;
        if (sched.time) time = sched.time;
        matched.push(token);
        continue;
      }

      // 30分 / 2時間 / 2時間30分 → 所要時間
      if ((m = token.match(DURATION_RE)) && (m[1] || m[2])) {
        durationMinutes = (m[1] ? +m[1] * 60 : 0) + (m[2] ? +m[2] : 0);
        matched.push(token);
        continue;
      }

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
    }

    rest.push(token);
  }

  // 第N週 + 曜日 が揃えば毎月◯曜の繰り返しとして扱う
  if (weekOfMonth !== null && weekday !== null) {
    repeat = "monthly-weekday";
  }

  let dueAt: Date | null = null;
  if (date || dayOffset !== null || weekday !== null || time) {
    let d = new Date(now);
    d.setSeconds(0, 0);
    if (date) {
      d.setFullYear(date.y, date.m - 1, date.d);
      if (!time && d < now && date.y === now.getFullYear()) {
        const sameDay =
          d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        if (!sameDay) d.setFullYear(d.getFullYear() + 1);
      }
    } else if (dayOffset !== null) {
      d.setDate(d.getDate() + dayOffset);
    } else if (weekday !== null && repeat === "monthly-weekday") {
      // 第N◯曜: 今月分が過ぎていれば翌月へ
      const hour = time ? time.h : DEFAULT_HOUR;
      const minute = time ? time.min : 0;
      let nd = nthWeekdayOfMonth(now.getFullYear(), now.getMonth(), weekday, weekOfMonth!);
      nd.setHours(hour, minute, 0, 0);
      if (nd <= now) {
        nd = nthWeekdayOfMonth(now.getFullYear(), now.getMonth() + 1, weekday, weekOfMonth!);
        nd.setHours(hour, minute, 0, 0);
      }
      d = nd;
    } else if (weekday !== null) {
      const diff = (weekday - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      // 毎月＋曜日(第N週指定なし)は、その日の週番号で毎月◯曜とみなす
      if (repeat === "monthly") {
        weekOfMonth = Math.ceil(d.getDate() / 7);
        repeat = "monthly-weekday";
      }
    }

    if (repeat !== "monthly-weekday") {
      if (time) {
        d.setHours(time.h, time.min, 0, 0);
        if (!date && dayOffset === null && weekday === null && d <= now) {
          d.setDate(d.getDate() + 1);
        }
      } else {
        d.setHours(DEFAULT_HOUR, 0, 0, 0);
      }
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
    weekday: repeat === "monthly-weekday" ? weekday : null,
    weekOfMonth: repeat === "monthly-weekday" ? weekOfMonth : null,
    durationMinutes,
    matched,
  };
}
