import { currentUser, jsonError } from "@/lib/auth";
import { authUrl, isConfigured } from "@/lib/gcal";

// 設定画面から新規タブ/リダイレクトで開かれ、Googleの同意画面へ遷移させる。
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  if (!isConfigured()) {
    return jsonError("Googleカレンダー連携が設定されていません", 400);
  }
  return Response.redirect(authUrl(user.id), 302);
}
