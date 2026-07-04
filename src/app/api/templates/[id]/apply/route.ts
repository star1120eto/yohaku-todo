import { updateDb, newId } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { resolveDueAt } from "@/lib/template";
import type { Folder, Task } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId ?? "");

  type Result = "notfound" | "forbidden" | { folder: Folder; tasks: Task[] };
  const result = updateDb<Result>((db) => {
    const tmpl = db.templates.find((t) => t.id === id && t.ownerId === user.id);
    if (!tmpl) return "notfound";
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";

    const now = new Date();
    const nowIso = now.toISOString();
    const folder: Folder = {
      id: newId(),
      workspaceId,
      name: String(body.folderName ?? tmpl.name).trim() || tmpl.name,
      order: db.folders.filter((f) => f.workspaceId === workspaceId).length,
      createdAt: nowIso,
    };
    db.folders.push(folder);
    logActivity(db, {
      workspaceId,
      actorId: user.id,
      type: "folder.create",
      detail: `フォルダ「${folder.name}」を作成`,
    });

    const created: Task[] = [];
    const newIdOf = new Map<number, string>();
    tmpl.items.forEach((item, idx) => {
      const parentId =
        item.parentIndex !== null ? newIdOf.get(item.parentIndex) ?? null : null;
      const t: Task = {
        id: newId(),
        workspaceId,
        folderId: folder.id,
        sectionId: null,
        parentId,
        title: item.title,
        note: item.note,
        completed: false,
        completedAt: null,
        priority: item.priority,
        tags: item.tags,
        dueAt: resolveDueAt(item, now),
        deadlineAt: null,
        reminders: [0],
        repeat: item.repeat,
        weekday: item.weekday,
        weekOfMonth: item.weekOfMonth,
        location: null,
        assigneeId: null,
        durationMinutes: null,
        createdBy: user.id,
        createdAt: nowIso,
        updatedAt: nowIso,
        order: created.length,
      };
      newIdOf.set(idx, t.id);
      db.tasks.push(t);
      created.push(t);
      logActivity(db, {
        workspaceId,
        taskId: t.id,
        actorId: user.id,
        type: "task.create",
        detail: `「${t.title}」を作成`,
      });
    });

    return { folder, tasks: created };
  });

  if (result === "notfound") return jsonError("テンプレートまたはワークスペースが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では作成できません", 403);
  return Response.json(result);
}
