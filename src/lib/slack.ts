import type { Database } from "./types";

/** 指定ユーザーがSlack通知を有効にしていれば、そのWebhookへメッセージを送る(fire-and-forget)。 */
export function notifyUserSlack(db: Database, userId: string, text: string) {
  const slack = db.settings.find((s) => s.userId === userId)?.slack;
  if (!slack?.enabled || !slack.webhookUrl) return;
  if (!/^https:\/\/hooks\.slack\.com\//.test(slack.webhookUrl)) return;
  fetch(slack.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {
    // 通知の失敗で本体の操作を止めない
  });
}
