import { readDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";

// ユーザー設定に保存された Slack Incoming Webhook へ通知を送る。
// Webhook URL はサーバー側にのみ保持し、クライアントには渡さない。
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return jsonError("本文がありません", 400);

  const db = readDb();
  const slack = db.settings.find((s) => s.userId === user.id)?.slack;
  if (!slack?.enabled || !slack.webhookUrl) {
    return jsonError("Slack通知が設定されていません", 400);
  }
  if (!/^https:\/\/hooks\.slack\.com\//.test(slack.webhookUrl)) {
    return jsonError("Slack Webhook URL が正しくありません", 400);
  }

  try {
    const res = await fetch(slack.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Slackへの送信に失敗しました", 502);
  }
}
