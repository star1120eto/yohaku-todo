-- Cloudflare D1 スキーマ。
-- v1 はシンプルさ優先で、アプリの Database 全体を 1 行の JSON として保持する
-- (旧 fs 版 JSON ファイルストアの D1 への素直な移行)。
-- 将来的にユーザー数が増えたら users/workspaces/tasks 等のテーブルに正規化する。
-- version は楽観的ロック(compare-and-swap)用。同時書き込みで一方が失われないようにする。
CREATE TABLE IF NOT EXISTS store (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);
