import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// 古典学派の方針に従い、ファイルシステムをモックせず本物の一時ディレクトリを使う。
// db.ts はモジュール読込時に DATA_DIR を確定するため、env を設定してから動的 import する。
let dataDir: string;
let db: typeof import("@/lib/db");

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "yohaku-db-"));
  process.env.YOHAKU_DATA_DIR = dataDir;
  db = await import("@/lib/db");
});

beforeEach(() => {
  // 各テストを独立させるため DB ファイルを消す(空状態に戻す)
  fs.rmSync(path.join(dataDir, "db.json"), { force: true });
});

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("readDb", () => {
  it("ファイルが無ければ空のデータベースを返す", () => {
    const data = db.readDb();
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
  it("変更を実ファイルへ永続化し、次の readDb に反映される", () => {
    db.updateDb((d) => {
      d.users.push({
        id: "u1",
        name: "テスト",
        email: "t@example.com",
        passwordHash: null,
        createdAt: "2026-06-15T00:00:00.000Z",
      });
    });

    // 同一プロセス内の別呼び出しでも、ファイルから読み直せること
    const reloaded = db.readDb();
    expect(reloaded.users).toHaveLength(1);
    expect(reloaded.users[0].name).toBe("テスト");

    // 実際にファイルが書かれていること
    const raw = JSON.parse(
      fs.readFileSync(path.join(dataDir, "db.json"), "utf8")
    );
    expect(raw.users[0].email).toBe("t@example.com");
  });

  it("コールバックの戻り値をそのまま返す", () => {
    const count = db.updateDb((d) => {
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
