import { test, expect } from "@playwright/test";
import { register, uniqueSuffix } from "./helpers";

test.describe("外部連携", () => {
  test("APIトークンを発行・失効できる", async ({ page }) => {
    await register(page);
    await page.getByRole("button", { name: "設定" }).click();
    const dialog = page.getByRole("dialog", { name: "設定" });

    const tokenName = `Zapier${uniqueSuffix()}`;
    await dialog.getByPlaceholder("トークン名(例: Zapier)").fill(tokenName);
    await dialog.getByRole("button", { name: "発行" }).click();

    await expect(dialog.getByText("発行されたトークン")).toBeVisible();
    const tokenRow = dialog.locator("li", { hasText: tokenName });
    await expect(tokenRow).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await tokenRow.getByRole("button", { name: "失効" }).click();
    await expect(tokenRow).toBeHidden();
  });

  test("プライベートIP宛のWebhookは拒否され、有効なURLは作成・削除できる", async ({
    page,
  }) => {
    await register(page);
    await page.getByRole("button", { name: "設定" }).click();
    const dialog = page.getByRole("dialog", { name: "設定" });

    await dialog.getByPlaceholder("https://example.com/webhook").fill(
      "http://127.0.0.1:9999/hook"
    );
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog.getByText("このURLは利用できません")).toBeVisible();

    await dialog
      .getByPlaceholder("https://example.com/webhook")
      .fill("https://example.com/hooks/yohaku");
    await dialog.getByRole("button", { name: "追加" }).click();

    const webhookRow = dialog.locator("li", { hasText: "https://example.com/hooks/yohaku" });
    await expect(webhookRow).toBeVisible();
    await expect(webhookRow.getByText("完了")).toBeVisible();

    await webhookRow.getByRole("button", { name: "削除" }).click();
    await expect(webhookRow).toBeHidden();
  });

  test("メール取り込み用トークンが表示され、未設定時はGoogleカレンダー連携欄が表示されない", async ({
    page,
  }) => {
    await register(page);
    await page.getByRole("button", { name: "設定" }).click();
    const dialog = page.getByRole("dialog", { name: "設定" });

    await expect(dialog.getByText(/\/api\/inbound-email\?token=[0-9a-f]+/)).toBeVisible();
    await expect(dialog.getByText("Googleカレンダー連携")).toBeHidden();
  });
});
