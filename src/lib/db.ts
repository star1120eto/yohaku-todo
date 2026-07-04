import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "./types";

// Cloudflare D1(無料枠の SQLite)を使った JSON ブロブ型のデータストア。
// v1 はシンプルさ優先で、アプリの Database 全体を 1 行の JSON として保持する
// (旧・ファイルシステム版 JSON ストアの D1 への素直な移行)。
// 将来ユーザー数が増えたら users/workspaces/tasks 等のテーブルに正規化する。

const EMPTY_DB: Database = {
  users: [],
  workspaces: [],
  folders: [],
  sections: [],
  tasks: [],
  settings: [],
  savedFilters: [],
  completions: [],
  activities: [],
};

let testD1: D1Database | undefined;

// テスト用に D1 バインディングを差し込むためのフック。
// vitest(Node)上では Cloudflare の実行コンテキストが存在しないため、
// テストからのみ実際の D1 の代わりを注入する。
export function __setD1ForTesting(db: D1Database | undefined): void {
  testD1 = db;
  schemaReady = false;
}

let schemaReady = false;

// テーブルが無ければ作る(初回アクセス時に自動で用意されるため、手動マイグレーションは不要)。
// Worker の isolate が生きている間は 1 度だけ実行すればよい。
async function ensureSchema(d1: D1Database): Promise<void> {
  if (schemaReady) return;
  await d1.exec(
    "CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0)"
  );
  schemaReady = true;
}

async function getD1(): Promise<D1Database> {
  const d1 = testD1 ?? (await getCloudflareContext({ async: true })).env.DB;
  await ensureSchema(d1);
  return d1;
}

// バージョン番号込みで読み込む。行がまだ無ければ version は -1(未作成)として扱う。
async function loadRow(
  d1: D1Database
): Promise<{ data: Database; version: number }> {
  const row = await d1
    .prepare("SELECT data, version FROM store WHERE id = 1")
    .first<{ data: string; version: number }>();
  if (!row) return { data: structuredClone(EMPTY_DB), version: -1 };
  return { data: { ...EMPTY_DB, ...JSON.parse(row.data) }, version: row.version };
}

// 読み込み時の version と一致する場合のみ書き込む(楽観的ロック)。
// 他のリクエストが間に割り込んで先に保存していた場合は false を返す。
async function trySave(
  d1: D1Database,
  data: Database,
  expectedVersion: number
): Promise<boolean> {
  const json = JSON.stringify(data);
  if (expectedVersion === -1) {
    const res = await d1
      .prepare(
        "INSERT INTO store (id, data, version) VALUES (1, ?1, 0) ON CONFLICT(id) DO NOTHING"
      )
      .bind(json)
      .run();
    return res.meta.changes === 1;
  }
  const res = await d1
    .prepare(
      "UPDATE store SET data = ?1, version = version + 1 WHERE id = 1 AND version = ?2"
    )
    .bind(json, expectedVersion)
    .run();
  return res.meta.changes === 1;
}

export async function readDb(): Promise<Database> {
  const d1 = await getD1();
  return (await loadRow(d1)).data;
}

// 読み取り→変更→書き込みを 1 箇所にまとめる。
// 複数リクエストが同時に読み書きしても更新を失わないよう、
// version による楽観的ロックで衝突時は読み直して再試行する。
const MAX_ATTEMPTS = 10;

export async function updateDb<T>(
  fn: (db: Database) => T | Promise<T>
): Promise<T> {
  const d1 = await getD1();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, version } = await loadRow(d1);
    const result = await fn(data);
    if (await trySave(d1, data, version)) return result;
  }
  throw new Error(
    "データの保存に失敗しました(他の更新と競合しています)。もう一度お試しください。"
  );
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(): string {
  return randomHex(8);
}

export function newInviteCode(): string {
  return randomHex(5);
}
