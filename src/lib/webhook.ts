import { createHmac } from "crypto";
import { isIP } from "net";
import { updateDb, type readDb } from "./db";
import type { Task, WebhookEvent } from "./types";

// プライベート/ループバックアドレス宛のWebhookは登録・送信のどちらも拒否する簡易SSRFガード。
// (ドメイン名はDNS解決までは検証しないため、DNSリバインディングへの完全な防御ではない)
function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") return true;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

export function isSafeWebhookUrl(urlStr: string): boolean {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (isIP(host)) return !isPrivateIp(host);
  return true;
}

function taskPayload(task: Task) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    completed: task.completed,
    dueAt: task.dueAt,
    priority: task.priority,
    tags: task.tags,
  };
}

// マッチするWebhookへイベントを配信する(ベストエフォート、失敗しても呼び出し元は止めない)。
export async function dispatchWebhooks(
  db: ReturnType<typeof readDb>,
  workspaceId: string,
  event: WebhookEvent,
  task: Task
) {
  const targets = db.webhooks.filter(
    (w) => w.workspaceId === workspaceId && w.events.includes(event)
  );
  if (!targets.length) return;

  const body = JSON.stringify({
    event,
    task: taskPayload(task),
    triggeredAt: new Date().toISOString(),
  });

  await Promise.all(
    targets.map(async (w) => {
      if (!isSafeWebhookUrl(w.url)) return;
      const signature = createHmac("sha256", w.secret).update(body).digest("hex");
      let status: number | null = null;
      try {
        const res = await fetch(w.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Yohaku-Signature": `sha256=${signature}`,
            "X-Yohaku-Event": event,
          },
          body,
        });
        status = res.status;
      } catch {
        status = null;
      }
      updateDb((d) => {
        const wh = d.webhooks.find((x) => x.id === w.id);
        if (wh) {
          wh.lastStatus = status;
          wh.lastTriggeredAt = new Date().toISOString();
        }
      });
    })
  );
}
