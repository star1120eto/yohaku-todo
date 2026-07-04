import { describe, it, expect, beforeEach } from "vitest";
import type { D1Database, D1ExecResult, D1Result } from "@cloudflare/workers-types";
import * as db from "@/lib/db";

// D1 は vitest(Node)上では利用できないため、実際に使う SQL 呼び出し形の
// 部分だけを満たす軽量な代替 D1(単一行の JSON ブロブを保持するだけ)を注入する。
// fs をモックしていた頃と同様、テスト対象自身のロジックはモックしない。
function createFakeD1(): D1Database {
  let stored: string | null = null;
  const statement = {
    bind: (json: string) => ({
      run: async () => {
        stored = json;
        return {} as D1Result;
      },
    }),
    first: async <T>() => (stored === null ? null : ({ data: stored } as unknown as T)),
  };
  return {
    prepare: () => statement,
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
