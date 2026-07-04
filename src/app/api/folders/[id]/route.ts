import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const folder = await updateDb((db) => {
    const f = db.folders.find((x) => x.id === id);
    if (!f) return null;
    const ws = db.workspaces.find((w) => w.id === f.workspaceId);
    if (!ws || !isMember(ws, user.id)) return null;
    if (typeof body.name === "string" && body.name.trim()) {
      f.name = body.name.trim();
    }
    return f;
  });

  if (!folder) return jsonError("フォルダが見つかりません", 404);
  return Response.json({ folder });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const ok = await updateDb((db) => {
    const f = db.folders.find((x) => x.id === id);
    if (!f) return false;
    const ws = db.workspaces.find((w) => w.id === f.workspaceId);
    if (!ws || !isMember(ws, user.id)) return false;
    db.folders = db.folders.filter((x) => x.id !== id);
    // フォルダ内のタスクは「フォルダなし」に移す
    for (const t of db.tasks) {
      if (t.folderId === id) t.folderId = null;
    }
    return true;
  });

  if (!ok) return jsonError("フォルダが見つかりません", 404);
  return Response.json({ ok: true });
}
