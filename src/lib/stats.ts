export interface DailyCount {
  date: string; // "YYYY-MM-DD"(ユーザーのタイムゾーン)
  count: number;
}

export interface StatsResult {
  daily: DailyCount[];
  todayCount: number;
  weekCount: number;
  totalCount: number;
  streak: number;
  bestStreak: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTCのISO時刻を、tzOffsetMin(UTCに足すと現地時刻になる分)での日付文字列にする。 */
function localDateStr(iso: string, tzOffsetMin: number): string {
  const d = new Date(new Date(iso).getTime() + tzOffsetMin * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function computeStats(
  completions: { completedAt: string }[],
  now: Date,
  tzOffsetMin: number,
  days: number
): StatsResult {
  const counts = new Map<string, number>();
  for (const c of completions) {
    const key = localDateStr(c.completedAt, tzOffsetMin);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const nowLocal = new Date(now.getTime() + tzOffsetMin * 60000);
  const dateKeyAt = (daysAgo: number) => {
    const d = new Date(nowLocal.getTime() - daysAgo * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };

  const daily: DailyCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKeyAt(i);
    daily.push({ date: key, count: counts.get(key) ?? 0 });
  }

  const todayCount = counts.get(dateKeyAt(0)) ?? 0;
  const weekCount = daily.slice(-7).reduce((s, d) => s + d.count, 0);
  const totalCount = completions.length;

  // 今日を含む連続達成日数(今日が0件ならまだ途切れていないとみなし昨日から数える)
  let streak = 0;
  {
    let i = counts.has(dateKeyAt(0)) ? 0 : 1;
    while (counts.has(dateKeyAt(i))) {
      streak++;
      i++;
    }
  }

  // 全期間での最長連続日数
  let bestStreak = streak;
  {
    const sorted = [...counts.keys()].sort();
    let run = 0;
    let prevMs: number | null = null;
    for (const key of sorted) {
      const ms = new Date(`${key}T00:00:00Z`).getTime();
      run = prevMs !== null && ms - prevMs === 86400000 ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
      prevMs = ms;
    }
  }

  return { daily, todayCount, weekCount, totalCount, streak, bestStreak };
}
