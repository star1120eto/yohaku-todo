import { readDb, updateDb, newId, randomHex } from "@/lib/db";
import { currentUser, hashApiToken, jsonError } from "@/lib/auth";
import type { ApiToken } from "@/lib/types";

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const db = await readDb();
  const tokens = db.apiTokens
    .filter((t) => t.userId === user.id)
    .map(({ tokenHash: _tokenHash, ...rest }) => rest)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ tokens });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError("トークン名を入力してください", 400);

  const plain = `yhk_${randomHex(24)}`;
  const token: ApiToken = {
    id: newId(),
    userId: user.id,
    name,
    tokenHash: await hashApiToken(plain),
    tokenPreview: `${plain.slice(0, 8)}...`,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await updateDb((db) => {
    db.apiTokens.push(token);
  });

  const { tokenHash: _tokenHash, ...preview } = token;
  return Response.json({ token: plain, info: preview });
}
