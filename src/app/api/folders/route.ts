import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { Folder } from "@/lib/types";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") ?? "";
  const db = await readDb();
  const ws = db.workspaces.find((w) => w.id === workspaceId);
  if (!ws || !isMember(ws, user.id)) {
    return jsonError("ワークスペースが見つかりません", 404);
  }
  const folders = db.folders
    .filter((f) => f.workspaceId === workspaceId)
    .sort((a, b) => a.order - b.order);
  return Response.json({ folders });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const workspaceId = String(body.workspaceId ?? "");
  if (!name) return jsonError("フォルダ名を入力してください", 400);

  type Result = "notfound" | "forbidden" | Folder;
  const result = await updateDb<Result>((db) => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    const existing = db.folders.find(
      (f) => f.workspaceId === workspaceId && f.name === name
    );
    if (existing) return existing;
    const f = {
      id: newId(),
      workspaceId,
      name,
      order: db.folders.filter((x) => x.workspaceId === workspaceId).length,
      createdAt: new Date().toISOString(),
    };
    db.folders.push(f);
    logActivity(db, {
      workspaceId,
      actorId: user.id,
      type: "folder.create",
      detail: `フォルダ「${f.name}」を作成`,
    });
    return f;
  });

  if (result === "notfound") return jsonError("ワークスペースが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では作成できません", 403);
  return Response.json({ folder: result });
}
