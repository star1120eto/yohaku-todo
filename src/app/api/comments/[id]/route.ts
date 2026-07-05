import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  type Result = "notfound" | "forbidden" | "ok";
  const result = await updateDb<Result>((db) => {
    const c = db.comments.find((x) => x.id === id);
    if (!c) return "notfound";
    const ws = db.workspaces.find((w) => w.id === c.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (c.authorId !== user.id && ws.ownerId !== user.id) return "forbidden";

    db.comments = db.comments.filter((x) => x.id !== id);
    return "ok";
  });

  if (result === "notfound") return jsonError("コメントが見つかりません", 404);
  if (result === "forbidden") return jsonError("削除できるのは投稿者かオーナーのみです", 403);
  return Response.json({ ok: true });
}
