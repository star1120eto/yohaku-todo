import { cookies } from "next/headers";
import { readDb } from "./db";
import type { MemberRole, User, Workspace } from "./types";

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

export function roleOf(ws: Workspace, userId: string): "owner" | MemberRole {
  if (ws.ownerId === userId) return "owner";
  return ws.memberRoles?.[userId] ?? "editor";
}

/** タスクの作成/編集/削除、フォルダ・セクション操作等ができるか。 */
export function canEdit(ws: Workspace, userId: string): boolean {
  return roleOf(ws, userId) !== "viewer";
}

// パスワードハッシュなどの機微情報を除いた、クライアントに返してよいユーザー表現。
export function publicUser(u: User): { id: string; name: string; email: string | null } {
  return { id: u.id, name: u.name, email: u.email };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
