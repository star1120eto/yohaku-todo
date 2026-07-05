import { readDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { base64ToUint8Array } from "@/lib/base64";

type Params = { params: Promise<{ commentId: string; attachmentId: string }> };

// メンバーシップを検証してから添付ファイルの実体(base64でDBに保持)を返す。
export async function GET(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const { commentId, attachmentId } = await params;

  const db = await readDb();
  const comment = db.comments.find((c) => c.id === commentId);
  const ws = comment && db.workspaces.find((w) => w.id === comment.workspaceId);
  if (!comment || !ws || !isMember(ws, user.id)) {
    return jsonError("ファイルが見つかりません", 404);
  }
  const attachment = comment.attachments.find((a) => a.id === attachmentId);
  if (!attachment) return jsonError("ファイルが見つかりません", 404);

  const data = new Blob([base64ToUint8Array(attachment.data)]);

  return new Response(data, {
    headers: {
      "Content-Type": attachment.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
