import fs from "fs";
import path from "path";
import { updateDb, uploadsDir } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { nextOccurrence } from "@/lib/recurrence";
import { notifyUserSlack } from "@/lib/slack";
import { logActivity } from "@/lib/activity";
import type { Task } from "@/lib/types";

function cleanDuration(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 5 && v <= 1440
    ? v
    : null;
}

function cleanReminders(v: unknown): number[] {
  if (!Array.isArray(v)) return [0];
  const nums = v.filter(
    (x): x is number =>
      typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 43200
  );
  const uniq = [...new Set(nums)].sort((a, b) => a - b).slice(0, 5);
  return uniq.length ? uniq : [0];
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  type Result = "notfound" | "forbidden" | Task;
  const result = await updateDb<Result>((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return "notfound";
    const ws = db.workspaces.find((w) => w.id === t.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) {
      // 閲覧のみの権限では、完了状態の切り替えだけを許可する
      const keys = Object.keys(body);
      if (keys.length !== 1 || keys[0] !== "completed" || typeof body.completed !== "boolean") {
        return "forbidden";
      }
    }

    const before = {
      title: t.title,
      dueAt: t.dueAt,
      priority: t.priority,
      folderId: t.folderId,
      tags: [...t.tags],
      repeat: t.repeat,
    };

    if (typeof body.title === "string" && body.title.trim()) {
      t.title = body.title.trim();
    }
    if (typeof body.note === "string") t.note = body.note;
    if ([0, 1, 2, 3].includes(body.priority)) t.priority = body.priority;
    if (Array.isArray(body.tags)) t.tags = body.tags.map(String);
    if ("folderId" in body) {
      const nextFolderId = typeof body.folderId === "string" ? body.folderId : null;
      if (nextFolderId !== t.folderId) {
        t.folderId = nextFolderId;
        t.sectionId = null; // フォルダを移動したら現在のセクション所属は外す
      }
      // 親のフォルダ移動には子も追従させる
      for (const c of db.tasks) {
        if (c.parentId === t.id) {
          c.folderId = t.folderId;
          c.sectionId = null;
        }
      }
    }
    if ("sectionId" in body) {
      if (typeof body.sectionId === "string" && t.folderId) {
        const section = db.sections.find(
          (x) => x.id === body.sectionId && x.folderId === t.folderId
        );
        t.sectionId = section ? section.id : null;
      } else {
        t.sectionId = null;
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
    if ("deadlineAt" in body) {
      t.deadlineAt = typeof body.deadlineAt === "string" ? body.deadlineAt : null;
    }
    if ("reminders" in body) {
      t.reminders = cleanReminders(body.reminders);
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
        db.completions.push({
          userId: user.id,
          workspaceId: t.workspaceId,
          taskId: t.id,
          completedAt: new Date().toISOString(),
        });
      } else {
        t.completed = body.completed;
        const completedAt = body.completed ? new Date().toISOString() : null;
        t.completedAt = completedAt;
        if (completedAt) {
          db.completions.push({
            userId: user.id,
            workspaceId: t.workspaceId,
            taskId: t.id,
            completedAt,
          });
        } else {
          db.completions = db.completions.filter((c) => c.taskId !== t.id);
        }
      }
      logActivity(db, {
        workspaceId: t.workspaceId,
        taskId: t.id,
        actorId: user.id,
        type: body.completed ? "task.complete" : "task.reopen",
        detail: body.completed
          ? `「${t.title}」を完了`
          : `「${t.title}」を未完了に戻す`,
      });
    }

    const changed: string[] = [];
    if (before.title !== t.title) changed.push("タイトル");
    if (before.dueAt !== t.dueAt) changed.push("期日");
    if (before.priority !== t.priority) changed.push("優先度");
    if (before.folderId !== t.folderId) changed.push("フォルダ");
    if (JSON.stringify(before.tags) !== JSON.stringify(t.tags)) changed.push("タグ");
    if (before.repeat !== t.repeat) changed.push("繰り返し");
    if (changed.length) {
      logActivity(db, {
        workspaceId: t.workspaceId,
        taskId: t.id,
        actorId: user.id,
        type: "task.update",
        detail: `「${t.title}」の${changed.join("・")}を変更`,
      });
    }

    t.updatedAt = new Date().toISOString();
    return t;
  });

  if (result === "notfound") return jsonError("タスクが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では変更できません", 403);
  return Response.json({ task: result });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { id } = await params;

  type Result = "notfound" | "forbidden" | "ok";
  const result = await updateDb<Result>((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return "notfound";
    const ws = db.workspaces.find((w) => w.id === t.workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    // 子タスクも同時に削除する
    const childIds = db.tasks.filter((x) => x.parentId === id).map((x) => x.id);
    const removedIds = new Set([id, ...childIds]);
    db.tasks = db.tasks.filter((x) => !removedIds.has(x.id));

    // コメント・添付ファイルの実体も削除する
    const removedComments = db.comments.filter((c) => removedIds.has(c.taskId));
    for (const c of removedComments) {
      for (const att of c.attachments) {
        try {
          fs.unlinkSync(path.join(uploadsDir(), att.path));
        } catch {
          // 実体が既に無くても無視する
        }
      }
    }
    db.comments = db.comments.filter((c) => !removedIds.has(c.taskId));

    logActivity(db, {
      workspaceId: t.workspaceId,
      taskId: null,
      actorId: user.id,
      type: "task.delete",
      detail: `「${t.title}」を削除`,
    });
    return "ok";
  });

  if (result === "notfound") return jsonError("タスクが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では削除できません", 403);
  return Response.json({ ok: true });
}
