import { cookies } from "next/headers";
import { UID_COOKIE, currentUser, destroySession, publicUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  return Response.json({ user: user ? publicUser(user) : null });
}

export async function DELETE() {
  const store = await cookies();
  const token = store.get(UID_COOKIE)?.value;
  if (token) await destroySession(token);
  store.delete(UID_COOKIE);
  return Response.json({ ok: true });
}
