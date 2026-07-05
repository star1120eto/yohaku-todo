import { updateDb } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { Folder } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  type Result = "notfound" | "forbidden" | Folder;
  const result = await updateDb<Result>((db) => {
    const f = db.folders.find((x) => x.id === id);
    if (!f) return "notfound";
    const ws = db.workspaces.find((w) => w.id === f.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    if (typeof body.name === "string" && body.name.trim()) {
      f.name = body.name.trim();
    }
    return f;
  });

  if (result === "notfound") return jsonError("フォルダが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では変更できません", 403);
  return Response.json({ folder: result });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  type Result = "notfound" | "forbidden" | "ok";
  const result = await updateDb<Result>((db) => {
    const f = db.folders.find((x) => x.id === id);
    if (!f) return "notfound";
    const ws = db.workspaces.find((w) => w.id === f.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    db.folders = db.folders.filter((x) => x.id !== id);
    db.sections = db.sections.filter((s) => s.folderId !== id);
    // フォルダ内のタスクは「フォルダなし」に移す
    for (const t of db.tasks) {
      if (t.folderId === id) {
        t.folderId = null;
        t.sectionId = null;
      }
    }
    logActivity(db, {
      workspaceId: f.workspaceId,
      actorId: user.id,
      type: "folder.delete",
      detail: `フォルダ「${f.name}」を削除`,
    });
    return "ok";
  });

  if (result === "notfound") return jsonError("フォルダが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では削除できません", 403);
  return Response.json({ ok: true });
}
