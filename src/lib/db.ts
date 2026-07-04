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
  tasks: [],
  settings: [],
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
    "CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)"
  );
  schemaReady = true;
}

async function getD1(): Promise<D1Database> {
  const d1 = testD1 ?? (await getCloudflareContext({ async: true })).env.DB;
  await ensureSchema(d1);
  return d1;
}

async function load(): Promise<Database> {
  const d1 = await getD1();
  const row = await d1
    .prepare("SELECT data FROM store WHERE id = 1")
    .first<{ data: string }>();
  if (!row) return structuredClone(EMPTY_DB);
  return { ...EMPTY_DB, ...JSON.parse(row.data) };
}

async function save(data: Database): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare(
      "INSERT INTO store (id, data) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET data = ?1"
    )
    .bind(JSON.stringify(data))
    .run();
}

export async function readDb(): Promise<Database> {
  return load();
}

// 読み取り→変更→書き込みを 1 箇所にまとめる。
export async function updateDb<T>(
  fn: (db: Database) => T | Promise<T>
): Promise<T> {
  const db = await load();
  const result = await fn(db);
  await save(db);
  return result;
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
