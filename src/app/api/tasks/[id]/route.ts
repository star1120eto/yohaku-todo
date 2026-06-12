import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { nextOccurrence } from "@/lib/recurrence";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const task = updateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return null;
    const ws = db.workspaces.find((w) => w.id === t.workspaceId);
    if (!ws || !isMember(ws, user.id)) return null;

    if (typeof body.title === "string" && body.title.trim()) {
      t.title = body.title.trim();
    }
    if (typeof body.note === "string") t.note = body.note;
    if ([0, 1, 2, 3].includes(body.priority)) t.priority = body.priority;
    if (Array.isArray(body.tags)) t.tags = body.tags.map(String);
    if ("folderId" in body) {
      t.folderId = typeof body.folderId === "string" ? body.folderId : null;
    }
    if ("dueAt" in body) {
      t.dueAt = typeof body.dueAt === "string" ? body.dueAt : null;
    }
    if ("repeat" in body) {
      t.repeat = ["daily", "weekly", "monthly"].includes(body.repeat)
        ? body.repeat
        : null;
    }
    if ("location" in body) {
      t.location =
        body.location && typeof body.location.lat === "number"
          ? {
              label: String(body.location.label ?? ""),
              lat: body.location.lat,
              lng: body.location.lng,
              radius: Number(body.location.radius) || 300,
            }
          : null;
    }
    if (typeof body.completed === "boolean") {
      if (body.completed && t.repeat && t.dueAt) {
        // 繰り返しタスクは完了せず次の予定日へ進める
        t.dueAt = nextOccurrence(new Date(t.dueAt), t.repeat).toISOString();
      } else {
        t.completed = body.completed;
        t.completedAt = body.completed ? new Date().toISOString() : null;
      }
    }
    t.updatedAt = new Date().toISOString();
    return t;
  });

  if (!task) return jsonError("タスクが見つかりません", 404);
  return Response.json({ task });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  const ok = updateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return false;
    const ws = db.workspaces.find((w) => w.id === t.workspaceId);
    if (!ws || !isMember(ws, user.id)) return false;
    db.tasks = db.tasks.filter((x) => x.id !== id);
    return true;
  });

  if (!ok) return jsonError("タスクが見つかりません", 404);
  return Response.json({ ok: true });
}
