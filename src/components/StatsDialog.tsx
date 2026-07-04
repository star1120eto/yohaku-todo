"use client";

import { useEffect, useState } from "react";
import { api } from "@/hooks/useData";
import type { WorkspaceWithMembers } from "@/hooks/useData";
import { Modal, inputClass } from "./ui";

interface StatsResult {
  daily: { date: string; count: number }[];
  todayCount: number;
  weekCount: number;
  totalCount: number;
  streak: number;
  bestStreak: number;
}

const TZ_OFFSET = -new Date().getTimezoneOffset();

export default function StatsDialog({
  workspaces,
  onClose,
}: {
  workspaces: WorkspaceWithMembers[];
  onClose: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [stats, setStats] = useState<StatsResult | null>(null);

  useEffect(() => {
    const q = workspaceId ? `&workspaceId=${workspaceId}` : "";
    api(`/api/stats?days=30&tzOffset=${TZ_OFFSET}${q}`, "GET").then(setStats);
  }, [workspaceId]);

  const max = Math.max(1, ...(stats?.daily.map((d) => d.count) ?? [1]));

  return (
    <Modal title="ふりかえり" onClose={onClose}>
      {workspaces.length > 1 && (
        <select
          className={`${inputClass} mb-4`}
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
        >
          <option value="">すべてのワークスペース</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      {!stats ? (
        <p className="text-sm text-ink-faint py-10 text-center">読み込み中…</p>
      ) : stats.totalCount === 0 ? (
        <p className="text-sm text-ink-faint py-10 text-center">
          まだ記録がありません。
          <br />
          ひとつ終わらせて余白をつくりましょう。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-line bg-paper/60 p-3 text-center">
              <div className="font-serif text-2xl">{stats.todayCount}</div>
              <div className="text-[11px] text-ink-faint mt-1">今日</div>
            </div>
            <div className="rounded-xl border border-line bg-paper/60 p-3 text-center">
              <div className="font-serif text-2xl">{stats.weekCount}</div>
              <div className="text-[11px] text-ink-faint mt-1">今週</div>
            </div>
            <div className="rounded-xl border border-line bg-paper/60 p-3 text-center">
              <div className="font-serif text-2xl">{stats.streak}</div>
              <div className="text-[11px] text-ink-faint mt-1">連続日数</div>
            </div>
          </div>

          <div className="mb-2 text-xs text-ink-soft">直近30日</div>
          <svg viewBox="0 0 300 60" className="w-full h-16" preserveAspectRatio="none">
            {stats.daily.map((d, i) => {
              const h = (d.count / max) * 52;
              return (
                <rect
                  key={d.date}
                  x={i * 10 + 1}
                  y={58 - h}
                  width={7}
                  height={Math.max(h, 1)}
                  rx={1.5}
                  className="fill-accent"
                  opacity={d.count === 0 ? 0.15 : 0.85}
                >
                  <title>
                    {d.date}: {d.count}件
                  </title>
                </rect>
              );
            })}
          </svg>
          <p className="text-[11px] text-ink-faint mt-2">
            最長連続 {stats.bestStreak}日 ・ 累計 {stats.totalCount}件
          </p>
        </>
      )}
    </Modal>
  );
}
