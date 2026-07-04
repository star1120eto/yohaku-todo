import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import type { Section } from "@/lib/types";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const folderId = new URL(req.url).searchParams.get("folderId") ?? "";
  const db = readDb();
  const folder = db.folders.find((f) => f.id === folderId);
  const ws = folder && db.workspaces.find((w) => w.id === folder.workspaceId);
  if (!folder || !ws || !isMember(ws, user.id)) {
    return jsonError("フォルダが見つかりません", 404);
  }
  const sections = db.sections
    .filter((s) => s.folderId === folderId)
    .sort((a, b) => a.order - b.order);
  return Response.json({ sections });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const folderId = String(body.folderId ?? "");
  if (!name) return jsonError("セクション名を入力してください", 400);

  type Result = "notfound" | "forbidden" | Section;
  const result = updateDb<Result>((db) => {
    const folder = db.folders.find((f) => f.id === folderId);
    const ws = folder && db.workspaces.find((w) => w.id === folder.workspaceId);
    if (!folder || !ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";
    const s = {
      id: newId(),
      workspaceId: folder.workspaceId,
      folderId,
      name,
      order: db.sections.filter((x) => x.folderId === folderId).length,
      createdAt: new Date().toISOString(),
    };
    db.sections.push(s);
    return s;
  });

  if (result === "notfound") return jsonError("フォルダが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では作成できません", 403);
  return Response.json({ section: result });
}
