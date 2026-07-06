import { updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { Workspace } from "@/lib/types";

// 招待コードでワークスペースに参加する
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (!code) return jsonError("招待コードを入力してください", 400);

  type JoinResult =
    | { ok: false; error: string; status: number }
    | { ok: true; workspace: Workspace };

  const result = await updateDb<JoinResult>((db) => {
    const w = db.workspaces.find((x) => x.inviteCode === code);
    if (!w) return { ok: false, error: "招待コードが正しくありません", status: 404 };
    if (w.private) {
      return { ok: false, error: "このワークスペースは共有できません", status: 403 };
    }
    if (w.ownerId !== user.id && !w.memberIds.includes(user.id)) {
      w.memberIds.push(user.id);
      w.memberRoles = w.memberRoles ?? {};
      w.memberRoles[user.id] = w.defaultRole ?? "editor";
      logActivity(db, {
        workspaceId: w.id,
        actorId: user.id,
        type: "member.join",
        detail: `${user.name} が参加`,
      });
    }
    return { ok: true, workspace: w };
  });

  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json({ workspace: result.workspace });
}
