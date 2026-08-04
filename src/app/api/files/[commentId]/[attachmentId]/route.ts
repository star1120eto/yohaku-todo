import { readDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { base64ToUint8Array } from "@/lib/base64";

type Params = { params: Promise<{ commentId: string; attachmentId: string }> };

// アップロード時のMIME許可リスト(POST /api/comments)とは別に、配信時にも
// 安全に inline 表示してよい形式を再チェックする(多層防御。過去に別の経路で
// 保存された想定外のmime――image/svg+xml等、トップレベル遷移でスクリプトが
// 実行され得る形式――があっても、ブラウザにHTML類似として解釈させない)。
const SAFE_INLINE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

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
  const safe = SAFE_INLINE_MIME.has(attachment.mime);

  return new Response(data, {
    headers: {
      "Content-Type": safe ? attachment.mime : "application/octet-stream",
      "Content-Disposition": `${safe ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
