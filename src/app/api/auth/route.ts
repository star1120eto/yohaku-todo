import { cookies } from "next/headers";
import { updateDb, newId, newInviteCode } from "@/lib/db";
import { UID_COOKIE, currentUser } from "@/lib/auth";
import { DEFAULT_PREFIXES } from "@/lib/types";

export async function GET() {
  const user = await currentUser();
  return Response.json({ user });
}

// 名前だけのかんたんログイン(v1)。ユーザーと最初のワークスペースを作成する。
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "名前を入力してください" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const user = updateDb((db) => {
    const u = { id: newId(), name, createdAt: now };
    db.users.push(u);
    db.workspaces.push({
      id: newId(),
      name: "個人",
      ownerId: u.id,
      memberIds: [],
      inviteCode: newInviteCode(),
      createdAt: now,
    });
    db.settings.push({ userId: u.id, prefixes: { ...DEFAULT_PREFIXES } });
    return u;
  });

  const store = await cookies();
  store.set(UID_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return Response.json({ user });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(UID_COOKIE);
  return Response.json({ ok: true });
}
