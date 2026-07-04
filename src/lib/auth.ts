import { cookies } from "next/headers";
import { readDb } from "./db";
import type { User, Workspace } from "./types";

export const UID_COOKIE = "yohaku_uid";

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const uid = store.get(UID_COOKIE)?.value;
  if (!uid) return null;
  const db = await readDb();
  return db.users.find((u) => u.id === uid) ?? null;
}

export function isMember(ws: Workspace, userId: string): boolean {
  return ws.ownerId === userId || ws.memberIds.includes(userId);
}

// パスワードハッシュなどの機微情報を除いた、クライアントに返してよいユーザー表現。
export function publicUser(u: User): { id: string; name: string; email: string | null } {
  return { id: u.id, name: u.name, email: u.email };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
