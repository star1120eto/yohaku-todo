import { test, expect } from "@playwright/test";
import { createServer, type Server, type IncomingMessage } from "node:http";
import { networkInterfaces } from "node:os";
import { register } from "./helpers";

// このコンテナ自身に割り当てられた非ループバックIPv4アドレスを取得する。
// isSafeWebhookUrl はループバック/プライベートIPのみ弾くため、実マシンのIP宛なら
// 本物のWebhook配信(実際のfetch)を本物のHTTPサーバーで受け取って検証できる。
function ownIpv4(): string {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  throw new Error("non-internal IPv4 address not found");
}

test.describe("外部連携の実動作", () => {
  test("発行したAPIトークンで/api/v1/tasksを呼び出せ、そのイベントでWebhookが実配信される", async ({
    page,
  }) => {
    await register(page);

    // APIトークンを発行して実際のトークン文字列を取得する
    await page.getByRole("button", { name: "設定" }).click();
    const dialog = page.getByRole("dialog", { name: "設定" });
    await dialog.getByPlaceholder("トークン名(例: Zapier)").fill("E2E連携");
    await dialog.getByRole("button", { name: "発行" }).click();
    // トークン一覧には「yhk_1234...」のような短いプレビューも表示されるため、
    // 実トークン(yhk_ + 48桁hex)だけにマッチする正規表現で区別する
    const issuedPanel = dialog.getByText(/発行されたトークン/);
    await expect(issuedPanel).toContainText(/yhk_[0-9a-f]{48}/);
    const issuedText = await issuedPanel.textContent();
    const token = issuedText?.match(/yhk_[0-9a-f]{48}/)?.[0];
    expect(token).toBeTruthy();

    // 現在のワークスペース(登録直後はプライベート)のIDを取得する
    const wsRes = await page.request.get("/api/workspaces");
    const { workspaces } = await wsRes.json();
    const privateWs = workspaces.find((w: { private: boolean }) => w.private);

    // 実際に受信するローカルHTTPサーバーを立てる(fetchはモックしない)
    const received: { headers: IncomingMessage["headers"]; body: string }[] = [];
    const server: Server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received.push({ headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
        res.writeHead(200);
        res.end("ok");
      });
    });
    const host = ownIpv4();
    await new Promise<void>((resolve) => server.listen(0, host, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server not listening");
    const webhookUrl = `http://${host}:${address.port}/hook`;

    // Webhookを登録する(作成イベントも通知対象に含める)
    await dialog.getByPlaceholder("https://example.com/webhook").fill(webhookUrl);
    await dialog.getByLabel("作成").check();
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog.locator("li", { hasText: webhookUrl })).toBeVisible();
    await page.keyboard.press("Escape");

    try {
      // 発行したトークンを使い、実際にBearer認証で /api/v1/tasks を呼び出す
      const createRes = await page.request.post("/api/v1/tasks", {
        headers: { Authorization: `Bearer ${token}` },
        data: { title: "API経由のタスク", workspaceId: privateWs.id },
      });
      expect(createRes.status()).toBe(201);
      const { task } = await createRes.json();
      expect(task.title).toBe("API経由のタスク");
      expect(task.workspaceId).toBe(privateWs.id);

      // Webhookの配信はfire-and-forgetのため、実際に届くまで待つ
      await expect.poll(() => received.length, { timeout: 30_000 }).toBeGreaterThan(0);
      const delivered = received[0];
      const payload = JSON.parse(delivered.body);
      expect(payload.event).toBe("task.create");
      expect(payload.task.id).toBe(task.id);
      expect(payload.task.title).toBe("API経由のタスク");
      expect(delivered.headers["x-yohaku-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(delivered.headers["x-yohaku-event"]).toBe("task.create");

      // 無効なトークンでは認証できない
      const invalidRes = await page.request.post("/api/v1/tasks", {
        headers: { Authorization: "Bearer yhk_invalid0000000000000000000000000000000000" },
        data: { title: "失敗するはず", workspaceId: privateWs.id },
      });
      expect(invalidRes.status()).toBe(401);
      expect((await invalidRes.json()).error).toBe("トークンが無効です");

      // トークン使用時刻(lastUsedAt)が記録される
      const tokensRes = await page.request.get("/api/tokens");
      const { tokens } = await tokensRes.json();
      const used = tokens.find((t: { name: string }) => t.name === "E2E連携");
      expect(used.lastUsedAt).not.toBeNull();

      // Webhook配信結果(ステータス)が設定画面に反映される
      await page.reload();
      await page.getByRole("button", { name: "設定" }).click();
      const dialog2 = page.getByRole("dialog", { name: "設定" });
      await expect(dialog2.getByText(/直近: 200/)).toBeVisible();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
