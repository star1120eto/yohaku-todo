import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { syncTaskToGoogle } from "@/lib/gcal";
import { dispatchWebhooks } from "@/lib/webhook";
import type { Task } from "@/lib/types";

// 外部連携用API。`Authorization: Bearer <トークン>` でのみ認証する(Cookieセッションは使わない)。
// 発行は設定画面の「APIトークン」から行う。

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return jsonError("トークンが無効です", 401);
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  const db = await readDb();
  const workspaceIds = new Set(
    db.workspaces.filter((w) => isMember(w, user.id)).map((w) => w.id)
  );
  if (workspaceId && !workspaceIds.has(workspaceId)) {
    return jsonError("ワークスペースが見つかりません", 404);
  }
  const tasks = db.tasks.filter(
    (t) =>
      workspaceIds.has(t.workspaceId) &&
      (!workspaceId || t.workspaceId === workspaceId)
  );
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const user = await currentUser(req);
  if (!user) return jsonError("トークンが無効です", 401);
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const workspaceId = String(body.workspaceId ?? "");
  if (!title) return jsonError("タイトルを入力してください", 400);

  const now = new Date().toISOString();
  type Result = "notfound" | "forbidden" | Task;
  const result = await updateDb<Result>((db) => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    const t: Task = {
      id: newId(),
      workspaceId,
      folderId: typeof body.folderId === "string" ? body.folderId : null,
      sectionId: null,
      parentId: null,
      title,
      note: typeof body.note === "string" ? body.note : "",
      completed: false,
      completedAt: null,
      priority: [0, 1, 2, 3].includes(body.priority) ? body.priority : 0,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      deadlineAt: null,
      reminders: [0],
      repeat: null,
      weekday: null,
      weekOfMonth: null,
      location: null,
      assigneeId: null,
      durationMinutes: null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      order: db.tasks.filter((x) => x.workspaceId === workspaceId).length,
    };
    db.tasks.push(t);
    logActivity(db, {
      workspaceId,
      taskId: t.id,
      actorId: user.id,
      type: "task.create",
      detail: `「${t.title}」を作成(API連携)`,
    });
    return t;
  });

  if (result === "notfound") return jsonError("ワークスペースが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では追加できません", 403);
  syncTaskToGoogle(user.id, result).catch(() => {});
  readDb()
    .then((db) => dispatchWebhooks(db, result.workspaceId, "task.create", result))
    .catch(() => {});
  return Response.json({ task: result }, { status: 201 });
}
