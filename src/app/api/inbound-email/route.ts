import { readDb, updateDb, newId } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseTitle } from "@/lib/parse";
import { DEFAULT_PREFIXES, type Task } from "@/lib/types";
import { jsonError } from "@/lib/auth";

// メール受信サービス(SendGrid Inbound Parse / Postmark 等)からのWebhookを受け、
// 件名をタイトル解析してプライベートワークスペースにタスクを作成する。
// 認証は ?token=<設定画面のメール取り込みトークン> のみで行う。
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return jsonError("トークンが必要です", 401);

  const contentType = req.headers.get("content-type") ?? "";
  let subject = "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    subject = String(body.subject ?? "").trim();
  } else {
    const form = await req.formData().catch(() => null);
    subject = String(form?.get("subject") ?? "").trim();
  }
  if (!subject) return jsonError("件名(subject)がありません", 400);

  const db = await readDb();
  const settings = db.settings.find((s) => s.inboundToken && s.inboundToken === token);
  if (!settings) return jsonError("トークンが無効です", 401);
  const workspace = db.workspaces.find(
    (w) => w.ownerId === settings.userId && w.private
  );
  if (!workspace) return jsonError("投稿先のワークスペースが見つかりません", 404);

  const prefixes = settings.prefixes ?? DEFAULT_PREFIXES;
  const parsed = parseTitle(subject, prefixes);
  const now = new Date().toISOString();

  const task: Task = {
    id: newId(),
    workspaceId: workspace.id,
    folderId: null,
    sectionId: null,
    parentId: null,
    title: parsed.title || subject,
    note: "",
    completed: false,
    completedAt: null,
    priority: parsed.priority,
    tags: parsed.tags,
    dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
    deadlineAt: null,
    reminders: [0],
    repeat: parsed.repeat,
    weekday: parsed.weekday,
    weekOfMonth: parsed.weekOfMonth,
    location: null,
    assigneeId: null,
    durationMinutes: parsed.durationMinutes,
    createdBy: settings.userId,
    createdAt: now,
    updatedAt: now,
    order: 0,
  };

  await updateDb((d) => {
    task.order = d.tasks.filter((x) => x.workspaceId === workspace.id).length;
    d.tasks.push(task);
    logActivity(d, {
      workspaceId: workspace.id,
      taskId: task.id,
      actorId: settings.userId,
      type: "task.create",
      detail: `「${task.title}」をメールから作成`,
    });
  });

  return Response.json({ ok: true, task }, { status: 201 });
}
