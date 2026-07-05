// @opennextjs/cloudflare が宣言するグローバル CloudflareEnv に D1 バインディングを追加する。
// `D1Database` は名前付き import のみを使い、ambient な Request/Response 等を
// 上書きしてしまう `@cloudflare/workers-types` の全体参照(triple-slash reference)は行わない
// (Next.js の DOM 由来の型と衝突するため)。
import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
