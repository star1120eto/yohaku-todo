import { cookies } from "next/headers";
import { updateDb, newId, newInviteCode } from "@/lib/db";
import { UID_COOKIE, publicUser } from "@/lib/auth";
import { hashPassword, isValidEmail } from "@/lib/password";
import { defaultSettings, type User } from "@/lib/types";

// メールアドレス + パスワードでアカウントを登録する。
// 同時に共有不可の個人スペース「プライベート」を初期作成する。
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim() || email.split("@")[0];

  if (!isValidEmail(email)) {
    return Response.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "パスワードは6文字以上にしてください" }, { status: 400 });
  }

  const now = new Date().toISOString();
  type RegResult = { ok: false } | { ok: true; user: User };
  const result = updateDb<RegResult>((db) => {
    if (db.users.some((u) => u.email === email)) {
      return { ok: false };
    }
    const u: User = {
      id: newId(),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: now,
    };
    db.users.push(u);
    db.workspaces.push({
      id: newId(),
      name: "プライベート",
      ownerId: u.id,
      memberIds: [],
      memberRoles: {},
      defaultRole: "editor",
      inviteCode: newInviteCode(),
      private: true,
      createdAt: now,
    });
    db.settings.push(defaultSettings(u.id));
    return { ok: true, user: u };
  });

  if (!result.ok) {
    return Response.json(
      { error: "このメールアドレスは既に登録されています" },
      { status: 409 }
    );
  }

  const store = await cookies();
  store.set(UID_COOKIE, result.user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return Response.json({ user: publicUser(result.user) });
}
