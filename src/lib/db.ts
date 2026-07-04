import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Database } from "./types";

// シンプルな JSON ファイルベースのデータストア。
// 外部サービスなしで動作させるための v1 実装で、
// 将来 PostgreSQL 等へ置き換えられるようこのモジュールに I/O を閉じ込めている。

const DATA_DIR = process.env.YOHAKU_DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

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
  comments: [],
  templates: [],
};

function load(): Database {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return { ...EMPTY_DB, ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

function save(db: Database) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function readDb(): Database {
  return load();
}

// 読み取り→変更→書き込みを 1 箇所にまとめる。Node のリクエスト処理は
// 同期コードが割り込まれないため、同期 I/O で十分な一貫性が得られる。
export function updateDb<T>(fn: (db: Database) => T): T {
  const db = load();
  const result = fn(db);
  save(db);
  return result;
}

export function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function newInviteCode(): string {
  return crypto.randomBytes(5).toString("hex");
}

/** コメント添付ファイルの保存先ディレクトリ(data/ 配下。db.json と同じ実体の根の下)。 */
export function uploadsDir(): string {
  return path.join(DATA_DIR, "uploads");
}
