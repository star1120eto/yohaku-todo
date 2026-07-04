import { readDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { matchesQuery } from "@/lib/format";
import type { Task } from "@/lib/types";

// 自分がメンバーの全ワークスペースを横断してタスクを検索する。
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ results: [] });

  const db = readDb();
  const myWorkspaces = db.workspaces.filter((w) => isMember(w, user.id));
  const wsNameById = new Map(myWorkspaces.map((w) => [w.id, w.name]));

  const results: (Task & { workspaceName: string })[] = [];
  for (const t of db.tasks) {
    if (!wsNameById.has(t.workspaceId)) continue;
    if (!matchesQuery([t.title, t.note, ...t.tags], q)) continue;
    results.push({ ...t, workspaceName: wsNameById.get(t.workspaceId)! });
    if (results.length >= 100) break;
  }

  return Response.json({ results });
}
