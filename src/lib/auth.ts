import { cookies } from "next/headers";
import { readDb, updateDb } from "./db";
import type { MemberRole, User, Workspace } from "./types";

export const UID_COOKIE = "yohaku_uid";

// Web Crypto (`crypto.subtle`) のみを使う(Node固有の crypto モジュールには依存しない)。
export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cookieセッションに加えて、外部連携用の `Authorization: Bearer <token>` も受け付ける。
export async function currentUser(req?: Request): Promise<User | null> {
  const auth = req?.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    const hash = await hashApiToken(token);
    const db = await readDb();
    const apiToken = db.apiTokens.find((t) => t.tokenHash === hash);
    if (!apiToken) return null;
    await updateDb((d) => {
      const t = d.apiTokens.find((x) => x.id === apiToken.id);
      if (t) t.lastUsedAt = new Date().toISOString();
    });
    return db.users.find((u) => u.id === apiToken.userId) ?? null;
  }

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
