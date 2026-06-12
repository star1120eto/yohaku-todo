import { cookies } from "next/headers";
import { readDb } from "./db";
import type { User, Workspace } from "./types";

export const UID_COOKIE = "yohaku_uid";

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const uid = store.get(UID_COOKIE)?.value;
  if (!uid) return null;
  const db = readDb();
  return db.users.find((u) => u.id === uid) ?? null;
}

export function isMember(ws: Workspace, userId: string): boolean {
  return ws.ownerId === userId || ws.memberIds.includes(userId);
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
