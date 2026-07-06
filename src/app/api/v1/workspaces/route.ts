import { readDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return jsonError("トークンが無効です", 401);
  const db = await readDb();
  const workspaces = db.workspaces
    .filter((w) => isMember(w, user.id))
    .map((w) => ({ id: w.id, name: w.name, private: w.private }));
  return Response.json({ workspaces });
}
