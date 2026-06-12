import { updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";

// 招待コードでワークスペースに参加する
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (!code) return jsonError("招待コードを入力してください", 400);

  const ws = updateDb((db) => {
    const w = db.workspaces.find((x) => x.inviteCode === code);
    if (!w) return null;
    if (w.ownerId !== user.id && !w.memberIds.includes(user.id)) {
      w.memberIds.push(user.id);
    }
    return w;
  });

  if (!ws) return jsonError("招待コードが正しくありません", 404);
  return Response.json({ workspace: ws });
}
