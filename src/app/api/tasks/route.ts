import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import type { Task } from "@/lib/types";

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
    const t: Task = {
      id: newId(),
      workspaceId,
      folderId: typeof body.folderId === "string" ? body.folderId : null,
      title,
      note: typeof body.note === "string" ? body.note : "",
      completed: false,
      completedAt: null,
      priority: [0, 1, 2, 3].includes(body.priority) ? body.priority : 0,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      repeat: ["daily", "weekly", "monthly"].includes(body.repeat)
        ? body.repeat
        : null,
      location:
        body.location && typeof body.location.lat === "number"
          ? {
              label: String(body.location.label ?? ""),
              lat: body.location.lat,
              lng: body.location.lng,
              radius: Number(body.location.radius) || 300,
            }
          : null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      order: db.tasks.filter((x) => x.workspaceId === workspaceId).length,
    };
    db.tasks.push(t);
    return t;
  });

  if (!task) return jsonError("ワークスペースが見つかりません", 404);
  return Response.json({ task });
}
