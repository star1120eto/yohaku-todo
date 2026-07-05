import { updateDb } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCode, fetchUserEmail, isConfigured } from "@/lib/gcal";

// Google OAuth のリダイレクト先。成功/失敗いずれもアプリのトップへ戻す。
export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = new URL("/", url.origin);

  const user = await currentUser();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!isConfigured() || !user || !code || !state || state !== user.id) {
    home.searchParams.set("gcal", "error");
    return Response.redirect(home.toString(), 302);
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // 再連携時など refresh_token が返らない場合がある。既存のものを維持する。
      const existing = await updateDb((db) =>
        db.googleAccounts.find((a) => a.userId === user.id)
      );
      if (!existing) throw new Error("no refresh token on first connect");
    }
    const email = await fetchUserEmail(tokens.access_token);
    const encAccessToken = await encryptSecret(tokens.access_token);
    const encRefreshToken = await encryptSecret(tokens.refresh_token ?? "");

    await updateDb((db) => {
      const existing = db.googleAccounts.find((a) => a.userId === user.id);
      const expiresAt = Date.now() + tokens.expires_in * 1000;
      if (existing) {
        existing.accessToken = encAccessToken;
        existing.expiresAt = expiresAt;
        existing.email = email || existing.email;
        if (tokens.refresh_token) {
          existing.refreshToken = encRefreshToken;
        }
      } else {
        db.googleAccounts.push({
          userId: user.id,
          email,
          accessToken: encAccessToken,
          refreshToken: encRefreshToken,
          expiresAt,
          calendarId: "primary",
          connectedAt: new Date().toISOString(),
        });
      }
    });
    home.searchParams.set("gcal", "connected");
  } catch {
    home.searchParams.set("gcal", "error");
  }

  return Response.redirect(home.toString(), 302);
}
