import { describe, it, expect, beforeEach } from "vitest";
import type { D1Database, D1ExecResult, D1Result } from "@cloudflare/workers-types";
import { createSession, destroySession, sha256Hex } from "@/lib/auth";
import * as db from "@/lib/db";

// tests/unit/db.test.ts と同様、D1 の SQL 呼び出し形だけを満たす軽量な代替を注入する。
function createFakeD1(): D1Database {
  let row: { data: string; version: number } | null = null;
  return {
    prepare(sql: string) {
      if (sql.startsWith("SELECT")) {
        return { first: async <T>() => (row ? (row as unknown as T) : null) };
      }
      if (sql.startsWith("INSERT")) {
        return {
          bind: (json: string) => ({
            run: async () => {
              if (row) return { meta: { changes: 0 } } as unknown as D1Result;
              row = { data: json, version: 0 };
              return { meta: { changes: 1 } } as unknown as D1Result;
            },
          }),
        };
      }
      return {
        bind: (json: string, expectedVersion: number) => ({
          run: async () => {
            if (!row || row.version !== expectedVersion) {
              return { meta: { changes: 0 } } as unknown as D1Result;
            }
            row = { data: json, version: row.version + 1 };
            return { meta: { changes: 1 } } as unknown as D1Result;
          },
        }),
      };
    },
    exec: async () => ({}) as D1ExecResult,
  } as unknown as D1Database;
}

beforeEach(() => {
  db.__setD1ForTesting(createFakeD1());
});

describe("createSession / destroySession", () => {
  it("発行したトークンはDBには平文で保存されない(SHA-256ハッシュのみ)", async () => {
    const token = await createSession("u1");
    const stored = await db.readDb();
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0].userId).toBe("u1");
    expect(stored.sessions[0].tokenHash).toBe(await sha256Hex(token));
    // 生トークンそのものは保存されていない
    expect(JSON.stringify(stored.sessions)).not.toContain(token);
  });

  it("発行のたびに異なる、推測不可能なトークンになる", async () => {
    const a = await createSession("u1");
    const b = await createSession("u1");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // randomHex(32) = 32バイト = 64桁16進
  });

  it("同一ユーザーが複数回ログインしても、既存セッションは残る(複数端末を想定)", async () => {
    await createSession("u1");
    await createSession("u1");
    const stored = await db.readDb();
    expect(stored.sessions.filter((s) => s.userId === "u1")).toHaveLength(2);
  });

  it("destroySessionで該当トークンのセッションだけを失効できる", async () => {
    const tokenA = await createSession("u1");
    const tokenB = await createSession("u1");

    await destroySession(tokenA);

    const stored = await db.readDb();
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0].tokenHash).toBe(await sha256Hex(tokenB));
  });

  it("destroySessionは存在しないトークンを渡してもエラーにならない", async () => {
    await expect(destroySession("does-not-exist")).resolves.toBeUndefined();
  });
});
