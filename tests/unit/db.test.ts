import { describe, it, expect, beforeEach } from "vitest";
import type { D1Database, D1ExecResult, D1Result } from "@cloudflare/workers-types";
import * as db from "@/lib/db";

// D1 は vitest(Node)上では利用できないため、実際に使う SQL 呼び出し形の
// 部分だけを満たす軽量な代替 D1 を注入する。fs をモックしていた頃と同様、
// テスト対象自身のロジックはモックしない。
// version 列を使った楽観的ロック(CAS)の挙動も本物の SQLite と同じように再現する。
function createFakeD1(): D1Database {
  let row: { data: string; version: number } | null = null;

  return {
    prepare(sql: string) {
      if (sql.startsWith("SELECT")) {
        return {
          first: async <T>() => (row ? (row as unknown as T) : null),
        };
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
      // UPDATE ... WHERE version = ?2
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

describe("readDb", () => {
  it("データが無ければ空のデータベースを返す", async () => {
    const data = await db.readDb();
    expect(data).toEqual({
      users: [],
      workspaces: [],
      folders: [],
      tasks: [],
      settings: [],
    });
  });
});

describe("updateDb", () => {
  it("変更を永続化し、次の readDb に反映される", async () => {
    await db.updateDb((d) => {
      d.users.push({
        id: "u1",
        name: "テスト",
        email: "t@example.com",
        passwordHash: null,
        createdAt: "2026-06-15T00:00:00.000Z",
      });
    });

    const reloaded = await db.readDb();
    expect(reloaded.users).toHaveLength(1);
    expect(reloaded.users[0].name).toBe("テスト");
    expect(reloaded.users[0].email).toBe("t@example.com");
  });

  it("コールバックの戻り値をそのまま返す", async () => {
    const count = await db.updateDb((d) => {
      d.folders.push({
        id: "f1",
        workspaceId: "w1",
        name: "仕事",
        order: 0,
        createdAt: "2026-06-15T00:00:00.000Z",
      });
      return d.folders.length;
    });
    expect(count).toBe(1);
  });

  it("同時に更新しても、後勝ちで片方の変更が失われない(楽観的ロックで再試行する)", async () => {
    const makeUser = (id: string) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      passwordHash: null,
      createdAt: "2026-06-15T00:00:00.000Z",
    });

    // 2つの更新をほぼ同時に実行し、両方の変更が残ることを確認する。
    // (以前の実装は読み込み→書き込みの間に割り込まれると片方を上書きして消していた)
    await Promise.all([
      db.updateDb((d) => {
        d.users.push(makeUser("u1"));
      }),
      db.updateDb((d) => {
        d.users.push(makeUser("u2"));
      }),
    ]);

    const reloaded = await db.readDb();
    const ids = reloaded.users.map((u) => u.id).sort();
    expect(ids).toEqual(["u1", "u2"]);
  });
});

describe("newId / newInviteCode", () => {
  it("newId は 16桁の16進数で、衝突しない", () => {
    const a = db.newId();
    const b = db.newId();
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
  });

  it("newInviteCode は 10桁の16進数", () => {
    expect(db.newInviteCode()).toMatch(/^[0-9a-f]{10}$/);
  });
});
