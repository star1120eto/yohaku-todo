import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const section = updateDb((db) => {
    const s = db.sections.find((x) => x.id === id);
    if (!s) return null;
    const ws = db.workspaces.find((w) => w.id === s.workspaceId);
    if (!ws || !isMember(ws, user.id)) return null;
    if (typeof body.name === "string" && body.name.trim()) {
      s.name = body.name.trim();
    }
    if (typeof body.order === "number") s.order = body.order;
    return s;
  });

  if (!section) return jsonError("セクションが見つかりません", 404);
  return Response.json({ section });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const ok = updateDb((db) => {
    const s = db.sections.find((x) => x.id === id);
    if (!s) return false;
    const ws = db.workspaces.find((w) => w.id === s.workspaceId);
    if (!ws || !isMember(ws, user.id)) return false;
    db.sections = db.sections.filter((x) => x.id !== id);
    // 所属タスクは「セクションなし」へ退避
    for (const t of db.tasks) {
      if (t.sectionId === id) t.sectionId = null;
    }
    return true;
  });

  if (!ok) return jsonError("セクションが見つかりません", 404);
  return Response.json({ ok: true });
}
