import { updateDb } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import type { Section } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  type Result = "notfound" | "forbidden" | Section;
  const result = updateDb<Result>((db) => {
    const s = db.sections.find((x) => x.id === id);
    if (!s) return "notfound";
    const ws = db.workspaces.find((w) => w.id === s.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    if (typeof body.name === "string" && body.name.trim()) {
      s.name = body.name.trim();
    }
    if (typeof body.order === "number") s.order = body.order;
    return s;
  });

  if (result === "notfound") return jsonError("セクションが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では変更できません", 403);
  return Response.json({ section: result });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  type Result = "notfound" | "forbidden" | "ok";
  const result = updateDb<Result>((db) => {
    const s = db.sections.find((x) => x.id === id);
    if (!s) return "notfound";
    const ws = db.workspaces.find((w) => w.id === s.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    db.sections = db.sections.filter((x) => x.id !== id);
    // 所属タスクは「セクションなし」へ退避
    for (const t of db.tasks) {
      if (t.sectionId === id) t.sectionId = null;
    }
    return "ok";
  });

  if (result === "notfound") return jsonError("セクションが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では削除できません", 403);
  return Response.json({ ok: true });
}
