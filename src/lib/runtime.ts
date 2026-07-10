import { getCloudflareContext } from "@opennextjs/cloudflare";

// Cloudflare Workersはレスポンスを返すと、ctx.waitUntil() に登録していない
// 非同期処理の実行を打ち切ることがある。Webhook配信・Slack通知・Googleカレンダー
// 同期など「レスポンスをブロックせずバックグラウンドで行う」処理は、
// 必ずこれで登録してから return する。
export async function backgroundTask(promise: Promise<unknown>): Promise<void> {
  const { ctx } = await getCloudflareContext({ async: true });
  ctx.waitUntil(promise);
}
