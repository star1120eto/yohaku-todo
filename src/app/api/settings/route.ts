import { readDb, updateDb } from "@/lib/db";
import { currentUser, jsonError } from "@/lib/auth";
import { defaultSettings, type Theme } from "@/lib/types";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = await readDb();
  const stored = db.settings.find((s) => s.userId === user.id);
  const settings = { ...defaultSettings(user.id), ...stored };
  return Response.json({ settings });
}

const THEMES: Theme[] = ["light", "dark", "system"];

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const p = body.prefixes ?? {};

  const clean = (v: unknown, fallback: string) => {
    const s = String(v ?? "").trim();
    return s.length >= 1 && s.length <= 3 ? s : fallback;
  };

  const settings = await updateDb((db) => {
    let s = db.settings.find((x) => x.userId === user.id);
    if (!s) {
      s = defaultSettings(user.id);
      db.settings.push(s);
    }
    // 既存データに theme / slack が無い場合の補完
    s.theme = s.theme ?? "system";
    s.slack = s.slack ?? { enabled: false, webhookUrl: "" };

    if (body.prefixes) {
      s.prefixes = {
        tag: clean(p.tag, s.prefixes.tag),
        priority: clean(p.priority, s.prefixes.priority),
        folder: clean(p.folder, s.prefixes.folder),
        parseDates:
          typeof p.parseDates === "boolean" ? p.parseDates : s.prefixes.parseDates,
      };
    }
    if (THEMES.includes(body.theme)) {
      s.theme = body.theme;
    }
    if (body.slack && typeof body.slack === "object") {
      s.slack = {
        enabled:
          typeof body.slack.enabled === "boolean"
            ? body.slack.enabled
            : s.slack.enabled,
        webhookUrl:
          typeof body.slack.webhookUrl === "string"
            ? body.slack.webhookUrl.trim()
            : s.slack.webhookUrl,
      };
    }
    return s;
  });
  return Response.json({ settings });
}
