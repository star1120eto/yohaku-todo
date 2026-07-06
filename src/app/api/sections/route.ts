import { readDb, updateDb, newId } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const folderId = new URL(req.url).searchParams.get("folderId") ?? "";
  const db = await readDb();
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

  const section = await updateDb((db) => {
    const folder = db.folders.find((f) => f.id === folderId);
    const ws = folder && db.workspaces.find((w) => w.id === folder.workspaceId);
    if (!folder || !ws || !isMember(ws, user.id)) return null;
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

  if (!section) return jsonError("フォルダが見つかりません", 404);
  return Response.json({ section });
}
