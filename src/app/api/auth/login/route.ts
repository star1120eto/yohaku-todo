import { cookies } from "next/headers";
import { readDb } from "@/lib/db";
import { UID_COOKIE, publicUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const db = await readDb();
  const user = db.users.find((u) => u.email === email);
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const store = await cookies();
  store.set(UID_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return Response.json({ user: publicUser(user) });
}
