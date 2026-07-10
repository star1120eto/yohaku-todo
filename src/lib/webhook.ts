import { updateDb } from "./db";
import type { Database, Task, WebhookEvent } from "./types";

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

// ホスト名がIPアドレスの直書きかどうかの簡易判定(ホスト名に ":" は含まれないため)
function isIpLiteral(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host.includes(":");
}

export function isSafeWebhookUrl(urlStr: string): boolean {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  // IPv6リテラルはURLのhostnameで "[::1]" のように角括弧付きになるため、
  // isPrivateIp/isIpLiteral へ渡す前に取り除く。
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (isIpLiteral(host)) return !isPrivateIp(host);
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

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

// マッチするWebhookへイベントを配信する(ベストエフォート、失敗しても呼び出し元は止めない)。
export async function dispatchWebhooks(
  db: Database,
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
      const signature = await hmacSha256Hex(w.secret, body);
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
      await updateDb((d) => {
        const wh = d.webhooks.find((x) => x.id === w.id);
        if (wh) {
          wh.lastStatus = status;
          wh.lastTriggeredAt = new Date().toISOString();
        }
      });
    })
  );
}
