import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { computeStats, type StatsResult } from "@/lib/stats";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const days = Math.min(90, Math.max(7, Number(url.searchParams.get("days")) || 30));
  const tzOffset = Number(url.searchParams.get("tzOffset")) || 0;

  type Result = { ok: false } | { ok: true; stats: StatsResult };
  const result = await updateDb<Result>((db) => {
    const ws = workspaceId ? db.workspaces.find((w) => w.id === workspaceId) : null;
    if (workspaceId && (!ws || !isMember(ws, user.id))) {
      return { ok: false };
    }

    // 導入時点の既存完了タスクから一度だけバックフィルする
    if (db.completions.length === 0) {
      const myWsIds = new Set(
        db.workspaces.filter((w) => isMember(w, user.id)).map((w) => w.id)
      );
      for (const t of db.tasks) {
        if (t.completed && t.completedAt && myWsIds.has(t.workspaceId)) {
          db.completions.push({
            userId: t.createdBy,
            workspaceId: t.workspaceId,
            taskId: t.id,
            completedAt: t.completedAt,
          });
        }
      }
    }

    let completions = db.completions.filter((c) => c.userId === user.id);
    if (workspaceId) {
      completions = completions.filter((c) => c.workspaceId === workspaceId);
    } else {
      const myWsIds = new Set(
        db.workspaces.filter((w) => isMember(w, user.id)).map((w) => w.id)
      );
      completions = completions.filter((c) => myWsIds.has(c.workspaceId));
    }
    return { ok: true, stats: computeStats(completions, new Date(), tzOffset, days) };
  });

  if (!result.ok) return jsonError("ワークスペースが見つかりません", 404);
  return Response.json(result.stats);
}
