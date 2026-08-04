import { cookies } from "next/headers";
import { readDb, updateDb, randomHex } from "./db";
import type { MemberRole, User, Workspace } from "./types";

export const UID_COOKIE = "yohaku_uid";

// Web Crypto (`crypto.subtle`) のみを使う(Node固有の crypto モジュールには依存しない)。
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ログインCookieには、推測不可能な乱数のセッショントークンを発行する
// (ユーザーIDをそのままCookieに使うと、そのIDが他のワークスペースメンバーに
// 見える箇所――メンバー一覧・タスクのcreatedBy/assigneeId等――から
// 誰でも「なりすまし用の認証情報」を入手できてしまうため)。
// トークン自体はDBにはSHA-256ハッシュのみ保存し、生の値はCookieにしか存在しない。
export async function createSession(userId: string): Promise<string> {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  await updateDb((db) => {
    db.sessions.push({ tokenHash, userId, createdAt: new Date().toISOString() });
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await updateDb((db) => {
    db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
  });
}

// Cookieセッションに加えて、外部連携用の `Authorization: Bearer <token>` も受け付ける。
export async function currentUser(req?: Request): Promise<User | null> {
  const auth = req?.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    const hash = await sha256Hex(token);
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
  const token = store.get(UID_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const db = await readDb();
  const session = db.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
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
