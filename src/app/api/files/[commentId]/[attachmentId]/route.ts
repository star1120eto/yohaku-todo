import fs from "fs";
import path from "path";
import { readDb, uploadsDir } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ commentId: string; attachmentId: string }> };

// メンバーシップを検証してから添付ファイルの実体を返す。
// data/ 配下は静的配信していないため、必ずこのルートを経由させる。
export async function GET(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { commentId, attachmentId } = await params;

  const db = readDb();
  const comment = db.comments.find((c) => c.id === commentId);
  const ws = comment && db.workspaces.find((w) => w.id === comment.workspaceId);
  if (!comment || !ws || !isMember(ws, user.id)) {
    return jsonError("ファイルが見つかりません", 404);
  }
  const attachment = comment.attachments.find((a) => a.id === attachmentId);
  if (!attachment) return jsonError("ファイルが見つかりません", 404);

  const filePath = path.join(uploadsDir(), attachment.path);
  let data: Blob;
  try {
    data = new Blob([fs.readFileSync(filePath)]);
  } catch {
    return jsonError("ファイルが見つかりません", 404);
  }

  return new Response(data, {
    headers: {
      "Content-Type": attachment.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
