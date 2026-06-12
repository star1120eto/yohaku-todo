import { readDb, updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";
import { DEFAULT_PREFIXES } from "@/lib/types";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = readDb();
  const settings = db.settings.find((s) => s.userId === user.id) ?? {
    userId: user.id,
    prefixes: { ...DEFAULT_PREFIXES },
  };
  return Response.json({ settings });
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const p = body.prefixes ?? {};

  const clean = (v: unknown, fallback: string) => {
    const s = String(v ?? "").trim();
    return s.length >= 1 && s.length <= 3 ? s : fallback;
  };

  const settings = updateDb((db) => {
    let s = db.settings.find((x) => x.userId === user.id);
    if (!s) {
      s = { userId: user.id, prefixes: { ...DEFAULT_PREFIXES } };
      db.settings.push(s);
    }
    s.prefixes = {
      tag: clean(p.tag, s.prefixes.tag),
      priority: clean(p.priority, s.prefixes.priority),
      folder: clean(p.folder, s.prefixes.folder),
      parseDates:
        typeof p.parseDates === "boolean" ? p.parseDates : s.prefixes.parseDates,
    };
    return s;
  });
  return Response.json({ settings });
}
