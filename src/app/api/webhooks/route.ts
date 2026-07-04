import { randomBytes } from "crypto";
import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { isSafeWebhookUrl } from "@/lib/webhook";
import { WEBHOOK_EVENTS, type Webhook, type WebhookEvent } from "@/lib/types";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") ?? "";
  const db = readDb();
  const ws = db.workspaces.find((w) => w.id === workspaceId);
  if (!ws || !isMember(ws, user.id)) {
    return jsonError("ワークスペースが見つかりません", 404);
  }
  const webhooks = db.webhooks
    .filter((w) => w.workspaceId === workspaceId && w.userId === user.id)
    .map(({ secret: _secret, ...rest }) => rest);
  return Response.json({ webhooks });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId ?? "");
  const url = String(body.url ?? "").trim();
  const events: WebhookEvent[] = Array.isArray(body.events)
    ? body.events.filter((e: unknown): e is WebhookEvent =>
        WEBHOOK_EVENTS.includes(e as WebhookEvent)
      )
    : [];

  if (!url) return jsonError("URLを入力してください", 400);
  if (!isSafeWebhookUrl(url)) {
    return jsonError("このURLは利用できません(http/https、かつプライベートIP以外を指定してください)", 400);
  }
  if (!events.length) return jsonError("通知するイベントを選択してください", 400);

  type Result = "notfound" | "forbidden" | Webhook;
  const result = updateDb<Result>((db) => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    const webhook: Webhook = {
      id: newId(),
      userId: user.id,
      workspaceId,
      url,
      secret: randomBytes(16).toString("hex"),
      events,
      createdAt: new Date().toISOString(),
      lastStatus: null,
      lastTriggeredAt: null,
    };
    db.webhooks.push(webhook);
    return webhook;
  });

  if (result === "notfound") return jsonError("ワークスペースが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では作成できません", 403);
  const { secret: _secret, ...preview } = result;
  return Response.json({ webhook: preview });
}
