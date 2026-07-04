import type { ActivityType, Database } from "./types";
import { newId } from "./db";

const MAX_PER_WORKSPACE = 1000;

/** アクティビティを記録する。ワークスペースあたり最新1000件になるよう古いものを間引く。 */
export function logActivity(
  db: Database,
  entry: {
    workspaceId: string;
    taskId?: string | null;
    actorId: string;
    type: ActivityType;
    detail: string;
  }
) {
  db.activities.push({
    id: newId(),
    workspaceId: entry.workspaceId,
    taskId: entry.taskId ?? null,
    actorId: entry.actorId,
    type: entry.type,
    detail: entry.detail,
    createdAt: new Date().toISOString(),
  });

  const forWs = db.activities.filter((a) => a.workspaceId === entry.workspaceId);
  if (forWs.length > MAX_PER_WORKSPACE) {
    const dropCount = forWs.length - MAX_PER_WORKSPACE;
    const dropIds = new Set(forWs.slice(0, dropCount).map((a) => a.id));
    db.activities = db.activities.filter((a) => !dropIds.has(a.id));
  }
}
