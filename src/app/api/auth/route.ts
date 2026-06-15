import { cookies } from "next/headers";
import { currentUser, publicUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  return Response.json({ user: user ? publicUser(user) : null });
}

export async function DELETE() {
  const store = await cookies();
  store.delete("yohaku_uid");
  return Response.json({ ok: true });
}
