import { readDb, updateDb } from "@/lib/db";
import { currentUser, isMember, jsonError } from "@/lib/auth";
import { defaultSettings, type FavoriteItem, type Theme } from "@/lib/types";

// フォルダ/フィルターの参照先が既に存在しないお気に入りを取り除く
function cleanseFavorites(
  db: ReturnType<typeof readDb>,
  userId: string,
  favorites: FavoriteItem[]
): FavoriteItem[] {
  return favorites.filter((f) => {
    if (f.type === "folder") {
      const [workspaceId, folderId] = f.ref.split(":");
      const ws = db.workspaces.find((w) => w.id === workspaceId);
      if (!ws || !isMember(ws, userId)) return false;
      return db.folders.some((x) => x.id === folderId && x.workspaceId === workspaceId);
    }
    if (f.type === "filter") {
      return db.savedFilters.some((x) => x.id === f.ref && x.userId === userId);
    }
    return true; // tag はワークスペース非依存のフリーテキストなのでそのまま残す
  });
}

export interface ResolvedFavorite extends FavoriteItem {
  label: string;
  workspaceId: string | null; // folder のみ。クリック時にワークスペースを切り替えるため
}

// お気に入りを表示用に解決する(フォルダ名・フィルター名を引く)。
// クライアントは現在のワークスペースのフォルダしか持たないため、サーバー側で解決する。
function resolveFavorites(
  db: ReturnType<typeof readDb>,
  userId: string,
  favorites: FavoriteItem[]
): ResolvedFavorite[] {
  return favorites
    .map((f): ResolvedFavorite | null => {
      if (f.type === "folder") {
        const [workspaceId, folderId] = f.ref.split(":");
        const folder = db.folders.find((x) => x.id === folderId);
        if (!folder) return null;
        return { ...f, label: folder.name, workspaceId };
      }
      if (f.type === "filter") {
        const sf = db.savedFilters.find((x) => x.id === f.ref && x.userId === userId);
        if (!sf) return null;
        return { ...f, label: sf.name, workspaceId: null };
      }
      return { ...f, label: f.ref, workspaceId: null };
    })
    .filter((f): f is ResolvedFavorite => f !== null)
    .sort((a, b) => a.order - b.order);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = await readDb();
  const stored = db.settings.find((s) => s.userId === user.id);
  const settings = { ...defaultSettings(user.id), ...stored };
  settings.favorites = cleanseFavorites(db, user.id, settings.favorites ?? []);
  const resolvedFavorites = resolveFavorites(db, user.id, settings.favorites);
  return Response.json({ settings, resolvedFavorites });
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
    // 既存データに theme / slack / favorites が無い場合の補完
    s.theme = s.theme ?? "system";
    s.slack = s.slack ?? { enabled: false, webhookUrl: "" };
    s.favorites = s.favorites ?? [];

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
    if (Array.isArray(body.favorites)) {
      const cleaned: FavoriteItem[] = body.favorites
        .filter(
          (f: unknown): f is FavoriteItem =>
            !!f &&
            typeof f === "object" &&
            ["folder", "tag", "filter"].includes((f as FavoriteItem).type) &&
            typeof (f as FavoriteItem).ref === "string"
        )
        .map((f: FavoriteItem, i: number) => ({ type: f.type, ref: f.ref, order: i }));
      s.favorites = cleanseFavorites(db, user.id, cleaned);
    }
    return s;
  });
  return Response.json({ settings });
}
