import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyUserSlack } from "@/lib/slack";
import { backgroundTask } from "@/lib/runtime";
import { arrayBufferToBase64 } from "@/lib/base64";
import type { Attachment } from "@/lib/types";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;
const ALLOWED_MIME = /^(image\/|application\/pdf$|text\/plain$)/;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const taskId = new URL(req.url).searchParams.get("taskId") ?? "";
  const db = await readDb();
  const task = db.tasks.find((t) => t.id === taskId);
  const ws = task && db.workspaces.find((w) => w.id === task.workspaceId);
  if (!task || !ws || !isMember(ws, user.id)) {
    return jsonError("タスクが見つかりません", 404);
  }
  const comments = db.comments
    .filter((c) => c.taskId === taskId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((c) => ({
      ...c,
      authorName: db.users.find((u) => u.id === c.authorId)?.name ?? "(不明)",
    }));
  return Response.json({ comments });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("リクエストの形式が正しくありません", 400);

  const taskId = String(form.get("taskId") ?? "");
  const body = String(form.get("body") ?? "").trim().slice(0, 2000);
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (!body && files.length === 0) {
    return jsonError("本文か添付ファイルを入力してください", 400);
  }
  if (files.length > MAX_FILES) {
    return jsonError(`添付ファイルは${MAX_FILES}件までです`, 400);
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return jsonError(`ファイルサイズは1件5MBまでです: ${f.name}`, 400);
    }
    if (f.type && !ALLOWED_MIME.test(f.type)) {
      return jsonError(`対応していないファイル形式です: ${f.name}`, 400);
    }
  }

  const db = await readDb();
  const task = db.tasks.find((t) => t.id === taskId);
  const ws = task && db.workspaces.find((w) => w.id === task.workspaceId);
  if (!task || !ws || !isMember(ws, user.id)) {
    return jsonError("タスクが見つかりません", 404);
  }

  const attachments: Attachment[] = [];
  for (const f of files) {
    attachments.push({
      id: newId(),
      name: f.name,
      size: f.size,
      mime: f.type || "application/octet-stream",
      data: arrayBufferToBase64(await f.arrayBuffer()),
    });
  }

  const slackNotifies: Promise<void>[] = [];
  const comment = await updateDb((db2) => {
    const c = {
      id: newId(),
      taskId,
      workspaceId: task.workspaceId,
      authorId: user.id,
      body,
      attachments,
      createdAt: new Date().toISOString(),
    };
    db2.comments.push(c);

    // 投稿者以外のワークスペースメンバーのうち、Slack通知が有効な人に通知
    const members = [ws.ownerId, ...ws.memberIds].filter((id) => id !== user.id);
    for (const memberId of members) {
      slackNotifies.push(
        notifyUserSlack(db2, memberId, `💬 「${task.title}」に ${user.name} がコメントしました`)
      );
    }

    logActivity(db2, {
      workspaceId: task.workspaceId,
      taskId,
      actorId: user.id,
      type: "task.comment",
      detail: `「${task.title}」にコメントを追加`,
    });
    return c;
  });

  if (slackNotifies.length) await backgroundTask(Promise.all(slackNotifies));

  return Response.json({ comment: { ...comment, authorName: user.name } });
}
