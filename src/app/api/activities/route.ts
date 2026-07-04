import { readDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId") ?? "";
  const taskId = url.searchParams.get("taskId");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  const db = readDb();
  const ws = db.workspaces.find((w) => w.id === workspaceId);
  if (!ws || !isMember(ws, user.id)) {
    return jsonError("ワークスペースが見つかりません", 404);
  }

  let list = db.activities.filter((a) => a.workspaceId === workspaceId);
  if (taskId) list = list.filter((a) => a.taskId === taskId);
  list = list
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  const activities = list.map((a) => ({
    ...a,
    actorName: db.users.find((u) => u.id === a.actorId)?.name ?? "(不明)",
  }));

  return Response.json({ activities });
}
