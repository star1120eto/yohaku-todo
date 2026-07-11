import { test, expect } from "@playwright/test";
import { register, uniqueSuffix } from "./helpers";

test.describe("外部連携の実動作", () => {
  test("発行したAPIトークンで/api/v1/tasksを実際に呼び出せ、そのイベントでWebhook配信が試行される", async ({
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

    // Webhookを登録する(作成イベントも通知対象に含める)。
    // 実際にネットワーク到達可能なURLかどうかはCI/サンドボックス環境によって
    // 変わり不安定なため、ここでは「配信自体が試行されること」までを検証し、
    // 署名やペイロードの正確さはNode環境で安定するtests/unit/webhook.test.tsで検証する。
    const webhookUrl = `https://example.com/hooks/e2e-${uniqueSuffix()}`;
    await dialog.getByPlaceholder("https://example.com/webhook").fill(webhookUrl);
    await dialog.getByLabel("作成").check();
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog.locator("li", { hasText: webhookUrl })).toBeVisible();
    await page.keyboard.press("Escape");

    // 発行したトークンを使い、実際にBearer認証で /api/v1/tasks を呼び出す
    const createRes = await page.request.post("/api/v1/tasks", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "API経由のタスク", workspaceId: privateWs.id },
    });
    expect(createRes.status()).toBe(201);
    const { task } = await createRes.json();
    expect(task.title).toBe("API経由のタスク");
    expect(task.workspaceId).toBe(privateWs.id);

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

    // Webhook配信が実際に試行される(fire-and-forgetがレスポンス後も打ち切られず実行される)ことを、
    // 配信結果の記録(lastTriggeredAt)が更新されることで確認する
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/webhooks?workspaceId=${privateWs.id}`);
          const { webhooks } = await res.json();
          return webhooks.find((w: { url: string }) => w.url === webhookUrl)?.lastTriggeredAt;
        },
        { timeout: 15_000 }
      )
      .not.toBeNull();
  });
});
