import { updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";
import { isConfigured } from "@/lib/gcal";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  if (!isConfigured()) return Response.json({ configured: false, connected: false });

  const account = await updateDb((db) =>
    db.googleAccounts.find((a) => a.userId === user.id)
  );
  if (!account) return Response.json({ configured: true, connected: false });
  return Response.json({
    configured: true,
    connected: true,
    email: account.email,
    calendarId: account.calendarId,
  });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const calendarId = String(body.calendarId ?? "").trim();
  if (!calendarId) return jsonError("カレンダーIDを入力してください", 400);

  const ok = await updateDb((db) => {
    const account = db.googleAccounts.find((a) => a.userId === user.id);
    if (!account) return false;
    account.calendarId = calendarId;
    return true;
  });
  if (!ok) return jsonError("連携されていません", 404);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  await updateDb((db) => {
    db.googleAccounts = db.googleAccounts.filter((a) => a.userId !== user.id);
    db.gcalEventLinks = db.gcalEventLinks.filter((l) => l.userId !== user.id);
  });
  return Response.json({ ok: true });
}
