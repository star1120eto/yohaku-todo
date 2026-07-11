import { updateDb, newId } from "@/lib/db";
import { currentUser, canEdit, isMember, jsonError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { parseTickTickCsv } from "@/lib/importExport";
import type { Folder, Section, Task } from "@/lib/types";

// TickTick等からエクスポートしたCSVを取り込み、新規フォルダとして展開する。
// 大量作成のため、単発のタスク作成とは異なりWebhook配信・Googleカレンダー同期は行わない
// (フォルダテンプレートの適用と同じ方針)。
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("リクエストの形式が正しくありません", 400);
  const workspaceId = String(form.get("workspaceId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("CSVファイルを選択してください", 400);

  const folderName =
    String(form.get("folderName") ?? "").trim() ||
    file.name.replace(/\.csv$/i, "").trim() ||
    "インポート";

  const text = await file.text();
  const plan = parseTickTickCsv(text);
  if (!plan.tasks.length) {
    return jsonError("インポートできるタスクが見つかりませんでした", 400);
  }

  const now = new Date().toISOString();
  type Result =
    | "notfound"
    | "forbidden"
    | { folder: Folder; sectionsCount: number; tasksCount: number };
  const result = await updateDb<Result>((db) => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    if (!ws || !isMember(ws, user.id)) return "notfound";
    if (!canEdit(ws, user.id)) return "forbidden";

    const folder: Folder = {
      id: newId(),
      workspaceId,
      name: folderName,
      order: db.folders.filter((f) => f.workspaceId === workspaceId).length,
      createdAt: now,
    };
    db.folders.push(folder);
    logActivity(db, {
      workspaceId,
      actorId: user.id,
      type: "folder.create",
      detail: `フォルダ「${folder.name}」を作成(CSVインポート)`,
    });

    const sectionIdByName = new Map<string, string>();
    plan.sections.forEach((name, i) => {
      const section: Section = {
        id: newId(),
        workspaceId,
        folderId: folder.id,
        name,
        order: i,
        createdAt: now,
      };
      db.sections.push(section);
      sectionIdByName.set(name, section.id);
    });

    // INDENT>=2 は直前のトップレベル項目のサブタスクとして扱う(1階層に丸める)
    let lastTopLevelId: string | null = null;
    let order = 0;
    const created: Task[] = [];
    for (const item of plan.tasks) {
      const sectionId = item.sectionName
        ? sectionIdByName.get(item.sectionName) ?? null
        : null;
      const parentId = item.indent >= 2 ? lastTopLevelId : null;

      const t: Task = {
        id: newId(),
        workspaceId,
        folderId: folder.id,
        sectionId,
        parentId,
        title: item.title,
        note: item.note,
        completed: false,
        completedAt: null,
        priority: item.priority,
        tags: [],
        dueAt: item.dueAt,
        deadlineAt: item.deadlineAt,
        reminders: [0],
        repeat: null,
        weekday: null,
        weekOfMonth: null,
        location: null,
        assigneeId: null,
        durationMinutes: item.durationMinutes,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
        order: order++,
      };
      db.tasks.push(t);
      created.push(t);
      if (!parentId) lastTopLevelId = t.id;

      logActivity(db, {
        workspaceId,
        taskId: t.id,
        actorId: user.id,
        type: "task.create",
        detail: `「${t.title}」を作成(CSVインポート)`,
      });
    }

    return { folder, sectionsCount: plan.sections.length, tasksCount: created.length };
  });

  if (result === "notfound") return jsonError("ワークスペースが見つかりません", 404);
  if (result === "forbidden") return jsonError("閲覧のみの権限では作成できません", 403);
  return Response.json(result, { status: 201 });
}
