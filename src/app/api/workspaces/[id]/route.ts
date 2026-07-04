import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const result = updateDb((db) => {
    const ws = db.workspaces.find((w) => w.id === id);
    if (!ws || !isMember(ws, user.id)) return null;
    if (typeof body.name === "string" && body.name.trim()) {
      ws.name = body.name.trim();
    }
    // メンバーの削除(オーナーのみ)
    if (typeof body.removeMemberId === "string" && ws.ownerId === user.id) {
      const removedName = db.users.find((u) => u.id === body.removeMemberId)?.name ?? "メンバー";
      ws.memberIds = ws.memberIds.filter((m) => m !== body.removeMemberId);
      for (const t of db.tasks) {
        if (t.workspaceId === ws.id && t.assigneeId === body.removeMemberId) {
          t.assigneeId = null;
        }
      }
      logActivity(db, {
        workspaceId: ws.id,
        actorId: user.id,
        type: "member.remove",
        detail: `${removedName} を削除`,
      });
    }
    // 自分が退出する
    if (body.leave === true && ws.ownerId !== user.id) {
      ws.memberIds = ws.memberIds.filter((m) => m !== user.id);
      for (const t of db.tasks) {
        if (t.workspaceId === ws.id && t.assigneeId === user.id) {
          t.assigneeId = null;
        }
      }
      logActivity(db, {
        workspaceId: ws.id,
        actorId: user.id,
        type: "member.leave",
        detail: `${user.name} が退出`,
      });
    }
    return ws;
  });

  if (!result) return jsonError("ワークスペースが見つかりません", 404);
  return Response.json({ workspace: result });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const result = updateDb((db) => {
    const ws = db.workspaces.find((w) => w.id === id);
    if (!ws || ws.ownerId !== user.id) return "forbidden" as const;
    if (ws.private) return "private" as const;
    db.workspaces = db.workspaces.filter((w) => w.id !== id);
    db.folders = db.folders.filter((f) => f.workspaceId !== id);
    db.sections = db.sections.filter((s) => s.workspaceId !== id);
    db.tasks = db.tasks.filter((t) => t.workspaceId !== id);
    return "ok" as const;
  });

  if (result === "private") {
    return jsonError("プライベートは削除できません", 403);
  }
  if (result === "forbidden") return jsonError("削除できるのはオーナーのみです", 403);
  return Response.json({ ok: true });
}
