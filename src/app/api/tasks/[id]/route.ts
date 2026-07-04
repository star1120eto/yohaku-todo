import { updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { nextOccurrence } from "@/lib/recurrence";
import { notifyUserSlack } from "@/lib/slack";

function cleanDuration(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 5 && v <= 1440
    ? v
    : null;
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const task = await updateDb((db) => {
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
      // 親のフォルダ移動には子も追従させる
      for (const c of db.tasks) {
        if (c.parentId === t.id) c.folderId = t.folderId;
      }
    }
    if ("parentId" in body) {
      if (typeof body.parentId === "string" && body.parentId !== t.id) {
        const parent = db.tasks.find(
          (x) => x.id === body.parentId && x.workspaceId === t.workspaceId
        );
        // 1階層のみ: 親自身が親を持つ場合、自分の子を親にする場合は拒否
        const wouldCycle = db.tasks.some(
          (x) => x.parentId === t.id && x.id === body.parentId
        );
        if (parent && !parent.parentId && !wouldCycle) {
          t.parentId = parent.id;
          t.folderId = parent.folderId;
        }
      } else {
        t.parentId = null;
      }
    }
    if ("dueAt" in body) {
      t.dueAt = typeof body.dueAt === "string" ? body.dueAt : null;
    }
    if ("repeat" in body) {
      t.repeat = ["daily", "weekly", "monthly", "monthly-weekday"].includes(body.repeat)
        ? body.repeat
        : null;
    }
    if ("weekday" in body) {
      t.weekday =
        typeof body.weekday === "number" && body.weekday >= 0 && body.weekday <= 6
          ? body.weekday
          : null;
    }
    if ("weekOfMonth" in body) {
      t.weekOfMonth =
        typeof body.weekOfMonth === "number" ? body.weekOfMonth : null;
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
    if ("assigneeId" in body) {
      const nextAssignee =
        typeof body.assigneeId === "string" && isMember(ws, body.assigneeId)
          ? body.assigneeId
          : null;
      if (nextAssignee !== t.assigneeId) {
        t.assigneeId = nextAssignee;
        if (nextAssignee && nextAssignee !== user.id) {
          notifyUserSlack(db, nextAssignee, `👤 「${t.title}」があなたに割り当てられました`);
        }
      }
    }
    if ("durationMinutes" in body) {
      t.durationMinutes = cleanDuration(body.durationMinutes);
    }
    if (typeof body.completed === "boolean") {
      if (body.completed && t.repeat && t.dueAt) {
        // 繰り返しタスクは完了せず次の予定日へ進める。子タスクは未完了に戻す
        t.dueAt = nextOccurrence(new Date(t.dueAt), {
          repeat: t.repeat,
          weekday: t.weekday,
          weekOfMonth: t.weekOfMonth,
        }).toISOString();
        for (const c of db.tasks) {
          if (c.parentId === t.id) {
            c.completed = false;
            c.completedAt = null;
          }
        }
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

  const ok = await updateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return false;
    const ws = db.workspaces.find((w) => w.id === t.workspaceId);
    if (!ws || !isMember(ws, user.id)) return false;
    // 子タスクも同時に削除する
    db.tasks = db.tasks.filter((x) => x.id !== id && x.parentId !== id);
    return true;
  });

  if (!ok) return jsonError("タスクが見つかりません", 404);
  return Response.json({ ok: true });
}
