import { readDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { buildTaskTree } from "@/lib/tree";
import { serializeTickTickCsv, type ExportTask } from "@/lib/importExport";
import type { Task } from "@/lib/types";

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

  const allTasks = db.tasks.filter((t) => t.folderId === folderId);
  const sections = db.sections
    .filter((s) => s.folderId === folderId)
    .sort((a, b) => a.order - b.order);

  const byOrder = (a: Task, b: Task) => a.order - b.order;
  const groups: { name: string | null; tasks: Task[] }[] = [
    { name: null, tasks: allTasks.filter((t) => !t.sectionId).sort(byOrder) },
    ...sections.map((s) => ({
      name: s.name,
      tasks: allTasks.filter((t) => t.sectionId === s.id).sort(byOrder),
    })),
  ];

  const exportTasks: ExportTask[] = [];
  for (const g of groups) {
    for (const node of buildTaskTree(g.tasks)) {
      exportTasks.push({
        title: node.task.title,
        note: node.task.note,
        priority: node.task.priority,
        dueAt: node.task.dueAt,
        deadlineAt: node.task.deadlineAt,
        durationMinutes: node.task.durationMinutes,
        sectionName: g.name,
        depth: node.depth,
      });
    }
  }

  const csv = serializeTickTickCsv(exportTasks);
  const encodedName = encodeURIComponent(`${folder.name}.csv`);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // 非ASCII文字を含むフォルダ名向けにRFC 5987のfilename*と、
      // 対応していないクライアント向けのASCIIフォールバックの両方を指定する。
      "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodedName}`,
    },
  });
}
