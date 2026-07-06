import { updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";
import { isEmptyQuery, parseQuery } from "@/lib/filterQuery";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const filter = await updateDb((db) => {
    const f = db.savedFilters.find((x) => x.id === id && x.userId === user.id);
    if (!f) return null;
    if (typeof body.name === "string" && body.name.trim()) {
      f.name = body.name.trim();
    }
    if (typeof body.query === "string" && !isEmptyQuery(parseQuery(body.query))) {
      f.query = body.query.trim();
    }
    return f;
  });

  if (!filter) return jsonError("フィルターが見つかりません", 404);
  return Response.json({ filter });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const ok = await updateDb((db) => {
    const before = db.savedFilters.length;
    db.savedFilters = db.savedFilters.filter(
      (x) => !(x.id === id && x.userId === user.id)
    );
    return db.savedFilters.length < before;
  });

  if (!ok) return jsonError("フィルターが見つかりません", 404);
  return Response.json({ ok: true });
}
