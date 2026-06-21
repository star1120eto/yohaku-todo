import { readDb, updateDb, newId, newInviteCode } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = readDb();
  const workspaces = db.workspaces
    .filter((w) => isMember(w, user.id))
    .map((w) => ({
      ...w,
      members: [w.ownerId, ...w.memberIds]
        .map((id) => db.users.find((u) => u.id === id))
        .filter(Boolean)
        .map((u) => ({ id: u!.id, name: u!.name })),
    }));
  return Response.json({ workspaces });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError("ワークスペース名を入力してください", 400);

  const ws = updateDb((db) => {
    const w = {
      id: newId(),
      name,
      ownerId: user.id,
      memberIds: [],
      inviteCode: newInviteCode(),
      private: false,
      createdAt: new Date().toISOString(),
    };
    db.workspaces.push(w);
    return w;
  });
  return Response.json({ workspace: ws });
}
