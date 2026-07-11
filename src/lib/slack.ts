import type { Database } from "./types";

/**
 * 指定ユーザーがSlack通知を有効にしていれば、そのWebhookへメッセージを送る。
 * 呼び出し元をブロックしないよう、返り値のPromiseは `backgroundTask()` に渡すこと
 * (Cloudflare Workersではレスポンス後に登録されていない非同期処理は打ち切られるため)。
 */
export function notifyUserSlack(
  db: Database,
  userId: string,
  text: string
): Promise<void> {
  const slack = db.settings.find((s) => s.userId === userId)?.slack;
  if (!slack?.enabled || !slack.webhookUrl) return Promise.resolve();
  if (!/^https:\/\/hooks\.slack\.com\//.test(slack.webhookUrl)) return Promise.resolve();
  return fetch(slack.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8000),
  })
    .then(() => {})
    .catch(() => {
      // 通知の失敗で本体の操作を止めない
    });
}
