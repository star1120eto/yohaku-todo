import { readDb, updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("テンプレート名を入力してください", 400);

  const ok = await updateDb((db) => {
    const t = db.templates.find((x) => x.id === id && x.ownerId === user.id);
    if (!t) return false;
    t.name = name;
    return true;
  });
  if (!ok) return jsonError("テンプレートが見つかりません", 404);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const db = await readDb();
  const exists = db.templates.some((t) => t.id === id && t.ownerId === user.id);
  if (!exists) return jsonError("テンプレートが見つかりません", 404);

  await updateDb((d) => {
    d.templates = d.templates.filter((t) => t.id !== id);
  });
  return Response.json({ ok: true });
}
