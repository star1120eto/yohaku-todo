import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";
import { isEmptyQuery, parseQuery } from "@/lib/filterQuery";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = await readDb();
  const filters = db.savedFilters
    .filter((f) => f.userId === user.id)
    .sort((a, b) => a.order - b.order);
  return Response.json({ filters });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const query = String(body.query ?? "").trim();
  if (!name) return jsonError("フィルター名を入力してください", 400);
  if (isEmptyQuery(parseQuery(query))) {
    return jsonError("絞り込み条件を1つ以上指定してください", 400);
  }

  const filter = await updateDb((db) => {
    const f = {
      id: newId(),
      userId: user.id,
      name,
      query,
      order: db.savedFilters.filter((x) => x.userId === user.id).length,
      createdAt: new Date().toISOString(),
    };
    db.savedFilters.push(f);
    return f;
  });

  return Response.json({ filter });
}
