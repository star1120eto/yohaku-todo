import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { toRelative } from "@/lib/template";
import type { Task, Template, TemplateItem } from "@/lib/types";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = await readDb();
  const templates = db.templates
    .filter((t) => t.ownerId === user.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return Response.json({ templates });
}

function toItem(t: Task, now: Date, parentIndex: number | null): TemplateItem {
  const { relDays, time } = toRelative(t.dueAt, now);
  return {
    title: t.title,
    note: t.note,
    priority: t.priority,
    tags: t.tags,
    relDays,
    time,
    repeat: t.repeat,
    weekday: t.weekday,
    weekOfMonth: t.weekOfMonth,
    parentIndex,
  };
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const workspaceId = String(body.workspaceId ?? "");
  const folderId = String(body.folderId ?? "");
  if (!name) return jsonError("テンプレート名を入力してください", 400);

  type Result = "notfound" | Template;
  const result = await updateDb<Result>((db) => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    const folder = db.folders.find(
      (f) => f.id === folderId && f.workspaceId === workspaceId
    );
    if (!folder) return "notfound";

    const now = new Date();
    const tasks = db.tasks.filter(
      (t) => t.folderId === folderId && !t.completed
    );
    const top = tasks
      .filter((t) => !t.parentId)
      .sort((a, b) => a.order - b.order);

    const items: TemplateItem[] = [];
    const indexOf = new Map<string, number>();
    for (const t of top) {
      indexOf.set(t.id, items.length);
      items.push(toItem(t, now, null));
    }
    for (const t of top) {
      const subs = tasks
        .filter((x) => x.parentId === t.id)
        .sort((a, b) => a.order - b.order);
      for (const s of subs) {
        items.push(toItem(s, now, indexOf.get(t.id) ?? null));
      }
    }

    const tmpl: Template = {
      id: newId(),
      ownerId: user.id,
      name,
      items,
      createdAt: now.toISOString(),
    };
    db.templates.push(tmpl);
    return tmpl;
  });

  if (result === "notfound") return jsonError("フォルダが見つかりません", 404);
  return Response.json({ template: result });
}
