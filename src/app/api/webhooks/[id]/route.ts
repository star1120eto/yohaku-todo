import { updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const ok = updateDb((db) => {
    const before = db.webhooks.length;
    db.webhooks = db.webhooks.filter((w) => !(w.id === id && w.userId === user.id));
    return db.webhooks.length < before;
  });
  if (!ok) return jsonError("Webhookが見つかりません", 404);
  return Response.json({ ok: true });
}
