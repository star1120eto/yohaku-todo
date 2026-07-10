import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { createServer, type Server, type IncomingMessage } from "node:http";
import { networkInterfaces } from "node:os";
import type { D1Database, D1ExecResult, D1Result } from "@cloudflare/workers-types";
import { isSafeWebhookUrl, dispatchWebhooks } from "@/lib/webhook";
import * as db from "@/lib/db";
import type { Task, Webhook } from "@/lib/types";

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

// このコンテナ自身に割り当てられた非ループバックIPv4アドレスを取得する。
// isSafeWebhookUrl はループバック/プライベートIPのみ弾くため、実マシンのIP宛なら
// 本物のHTTPサーバーへ本物のfetchでPOSTさせて配信ロジックを検証できる(fetchはモックしない)。
function ownIpv4(): string {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  throw new Error("non-internal IPv4 address not found");
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    workspaceId: "w1",
    folderId: null,
    sectionId: null,
    parentId: null,
    title: "タスク",
    note: "",
    completed: true,
    completedAt: "2026-06-15T00:00:00.000Z",
    priority: 2,
    tags: ["仕事"],
    dueAt: null,
    deadlineAt: null,
    reminders: [0],
    repeat: null,
    weekday: null,
    weekOfMonth: null,
    location: null,
    assigneeId: null,
    durationMinutes: null,
    createdBy: "u1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    order: 0,
    ...overrides,
  };
}

describe("isSafeWebhookUrl", () => {
  it("httpsやhttpの通常のURLは許可する", () => {
    expect(isSafeWebhookUrl("https://example.com/hooks/yohaku")).toBe(true);
    expect(isSafeWebhookUrl("http://example.com/hook")).toBe(true);
  });

  it("不正なURL文字列は拒否する", () => {
    expect(isSafeWebhookUrl("not a url")).toBe(false);
  });

  it("http/https以外のプロトコルは拒否する", () => {
    expect(isSafeWebhookUrl("ftp://example.com/hook")).toBe(false);
    expect(isSafeWebhookUrl("file:///etc/passwd")).toBe(false);
  });

  it("localhostや.localホスト名は拒否する", () => {
    expect(isSafeWebhookUrl("http://localhost/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://my-machine.local/hook")).toBe(false);
  });

  it("ループバック・プライベートIPリテラルは拒否する", () => {
    expect(isSafeWebhookUrl("http://127.0.0.1/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://10.0.0.5/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://192.168.1.1/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://172.16.0.1/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://172.31.255.255/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://169.254.1.1/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://[::1]/hook")).toBe(false);
  });

  it("172.x はプライベート範囲(16-31)の境界外なら許可する", () => {
    expect(isSafeWebhookUrl("http://172.15.255.255/hook")).toBe(true);
    expect(isSafeWebhookUrl("http://172.32.0.0/hook")).toBe(true);
  });

  it("パブリックIPリテラルは許可する", () => {
    expect(isSafeWebhookUrl("http://8.8.8.8/hook")).toBe(true);
  });
});

describe("dispatchWebhooks", () => {
  let server: Server;
  let received: { headers: IncomingMessage["headers"]; body: string } | null;
  let webhookUrl: string;

  beforeEach(async () => {
    db.__setD1ForTesting(createFakeD1());
    received = null;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = { headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
        res.writeHead(200);
        res.end("ok");
      });
    });
    const host = ownIpv4();
    await new Promise<void>((resolve) => server.listen(0, host, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server not listening");
    webhookUrl = `http://${host}:${address.port}/hook`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.__setD1ForTesting(undefined);
  });

  it("登録したイベントに一致するWebhookへ、HMAC-SHA256署名付きで実際にPOSTする", async () => {
    const secret = "test-secret-abc123";
    const webhook: Webhook = {
      id: "wh1",
      userId: "u1",
      workspaceId: "w1",
      url: webhookUrl,
      secret,
      events: ["task.complete"],
      createdAt: "2026-06-01T00:00:00.000Z",
      lastStatus: null,
      lastTriggeredAt: null,
    };
    await db.updateDb((d) => {
      d.webhooks.push(webhook);
    });
    const dbState = await db.readDb();

    const task = makeTask();
    await dispatchWebhooks(dbState, "w1", "task.complete", task);

    expect(received).not.toBeNull();
    const payload = JSON.parse(received!.body);
    expect(payload.event).toBe("task.complete");
    expect(payload.task).toEqual({
      id: task.id,
      workspaceId: task.workspaceId,
      title: task.title,
      completed: task.completed,
      dueAt: task.dueAt,
      priority: task.priority,
      tags: task.tags,
    });
    expect(typeof payload.triggeredAt).toBe("string");

    const expectedSignature = createHmac("sha256", secret)
      .update(received!.body)
      .digest("hex");
    expect(received!.headers["x-yohaku-signature"]).toBe(`sha256=${expectedSignature}`);
    expect(received!.headers["x-yohaku-event"]).toBe("task.complete");

    // 送信結果(ステータスコード・送信時刻)がDBに反映される
    const after = await db.readDb();
    const stored = after.webhooks.find((w) => w.id === "wh1");
    expect(stored?.lastStatus).toBe(200);
    expect(stored?.lastTriggeredAt).not.toBeNull();
  });

  it("登録イベントに一致しないWebhookへは配信しない", async () => {
    const webhook: Webhook = {
      id: "wh2",
      userId: "u1",
      workspaceId: "w1",
      url: webhookUrl,
      secret: "s",
      events: ["task.delete"],
      createdAt: "2026-06-01T00:00:00.000Z",
      lastStatus: null,
      lastTriggeredAt: null,
    };
    await db.updateDb((d) => {
      d.webhooks.push(webhook);
    });
    const dbState = await db.readDb();

    await dispatchWebhooks(dbState, "w1", "task.complete", makeTask());
    expect(received).toBeNull();
  });

  it("別ワークスペース宛のWebhookへは配信しない", async () => {
    const webhook: Webhook = {
      id: "wh3",
      userId: "u1",
      workspaceId: "other-workspace",
      url: webhookUrl,
      secret: "s",
      events: ["task.complete"],
      createdAt: "2026-06-01T00:00:00.000Z",
      lastStatus: null,
      lastTriggeredAt: null,
    };
    await db.updateDb((d) => {
      d.webhooks.push(webhook);
    });
    const dbState = await db.readDb();

    await dispatchWebhooks(dbState, "w1", "task.complete", makeTask());
    expect(received).toBeNull();
  });

  it("安全でないURL(SSRF対象)のWebhookは実際に送信せずスキップする", async () => {
    const webhook: Webhook = {
      id: "wh4",
      userId: "u1",
      workspaceId: "w1",
      url: "http://127.0.0.1:1/hook",
      secret: "s",
      events: ["task.complete"],
      createdAt: "2026-06-01T00:00:00.000Z",
      lastStatus: null,
      lastTriggeredAt: null,
    };
    await db.updateDb((d) => {
      d.webhooks.push(webhook);
    });
    const dbState = await db.readDb();

    await dispatchWebhooks(dbState, "w1", "task.complete", makeTask());
    expect(received).toBeNull();
    const after = await db.readDb();
    // 送信自体を試みていないので lastStatus は更新されない
    expect(after.webhooks.find((w) => w.id === "wh4")?.lastStatus).toBeNull();
  });
});
