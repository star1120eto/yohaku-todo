import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { notifyUserSlack } from "@/lib/slack";
import type { Task } from "@/lib/types";

function cleanDuration(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 5 && v <= 1440
    ? v
    : null;
}

// dueAt の何分前に通知するか。既定は [0](期日ちょうど)。最大5件・30日前まで
function cleanReminders(v: unknown): number[] {
  if (!Array.isArray(v)) return [0];
  const nums = v.filter(
    (x): x is number =>
      typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 43200
  );
  const uniq = [...new Set(nums)].sort((a, b) => a - b).slice(0, 5);
  return uniq.length ? uniq : [0];
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") ?? "";
  const db = readDb();
  const ws = db.workspaces.find((w) => w.id === workspaceId);
  if (!ws || !isMember(ws, user.id)) {
    return jsonError("ワークスペースが見つかりません", 404);
  }
  const tasks = db.tasks
    .filter((t) => t.workspaceId === workspaceId)
    .sort((a, b) => a.order - b.order);
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const workspaceId = String(body.workspaceId ?? "");
  if (!title) return jsonError("タイトルを入力してください", 400);

  const now = new Date().toISOString();
  const task = updateDb((db) => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return null;

    let parentId: string | null = null;
    let folderId: string | null =
      typeof body.folderId === "string" ? body.folderId : null;
    if (typeof body.parentId === "string") {
      const parent = db.tasks.find(
        (x) => x.id === body.parentId && x.workspaceId === workspaceId
      );
      // 1階層のみ許可: 親自身が親を持つ場合はサブタスク化しない
      if (parent && !parent.parentId) {
        parentId = parent.id;
        folderId = parent.folderId; // 子は親のフォルダに従う
      }
    }

    const t: Task = {
      id: newId(),
      workspaceId,
      folderId,
      parentId,
      title,
      note: typeof body.note === "string" ? body.note : "",
      completed: false,
      completedAt: null,
      priority: [0, 1, 2, 3].includes(body.priority) ? body.priority : 0,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      deadlineAt: typeof body.deadlineAt === "string" ? body.deadlineAt : null,
      reminders: cleanReminders(body.reminders),
      repeat: ["daily", "weekly", "monthly", "monthly-weekday"].includes(body.repeat)
        ? body.repeat
        : null,
      weekday:
        typeof body.weekday === "number" && body.weekday >= 0 && body.weekday <= 6
          ? body.weekday
          : null,
      weekOfMonth:
        typeof body.weekOfMonth === "number" ? body.weekOfMonth : null,
      location:
        body.location && typeof body.location.lat === "number"
          ? {
              label: String(body.location.label ?? ""),
              lat: body.location.lat,
              lng: body.location.lng,
              radius: Number(body.location.radius) || 300,
            }
          : null,
      assigneeId:
        typeof body.assigneeId === "string" && isMember(ws, body.assigneeId)
          ? body.assigneeId
          : null,
      durationMinutes: cleanDuration(body.durationMinutes),
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      order: db.tasks.filter((x) => x.workspaceId === workspaceId).length,
    };
    db.tasks.push(t);
    if (t.assigneeId && t.assigneeId !== user.id) {
      notifyUserSlack(db, t.assigneeId, `👤 「${t.title}」があなたに割り当てられました`);
    }
    return t;
  });

  if (!task) return jsonError("ワークスペースが見つかりません", 404);
  return Response.json({ task });
}
