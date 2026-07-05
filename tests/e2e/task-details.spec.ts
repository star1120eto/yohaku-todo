import { test, expect } from "@playwright/test";
import {
  register,
  addTask,
  openTask,
  createSharedWorkspace,
  getInviteUrl,
  joinAsNewMember,
  uniqueSuffix,
} from "./helpers";

test.describe("サブタスク", () => {
  test("追加・完了・削除ができる", async ({ page }) => {
    await register(page);
    await addTask(page, "資料作成");
    await openTask(page, "資料作成");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });

    await dialog.getByPlaceholder("サブタスクを追加").fill("目次を作る");
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog.getByText("目次を作る")).toBeVisible();
    await expect(dialog.getByText("0/1")).toBeVisible();

    // 完了にすると進捗表示が更新される
    await dialog
      .locator("li", { hasText: "目次を作る" })
      .getByRole("button", { name: "完了にする" })
      .click();
    await expect(dialog.getByText("1/1")).toBeVisible();

    // 削除すると一覧から消える
    await dialog
      .locator("li", { hasText: "目次を作る" })
      .getByRole("button", { name: "×" })
      .click();
    await expect(dialog.getByText("目次を作る")).toBeHidden();
  });

  test("親タスクを完了しても未完了のサブタスクが残る場合は確認される", async ({
    page,
  }) => {
    await register(page);
    await addTask(page, "引っ越し準備");
    await openTask(page, "引っ越し準備");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });
    await dialog.getByPlaceholder("サブタスクを追加").fill("段ボールを買う");
    await dialog.getByRole("button", { name: "追加" }).click();
    await dialog.getByRole("button", { name: "キャンセル" }).click();

    page.once("dialog", (d) => d.accept());
    await page
      .locator("li", { hasText: "引っ越し準備" })
      .getByRole("button", { name: "完了にする" })
      .click();
    await expect(page.getByText(/完了済み（1）/)).toBeVisible();
  });
});

test.describe("所要時間", () => {
  test("設定すると一覧にバッジが表示される", async ({ page }) => {
    await register(page);
    await addTask(page, "レポート執筆");
    await openTask(page, "レポート執筆");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });

    await dialog.getByLabel("所要時間").selectOption({ label: "1時間30分" });
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    const item = page.locator("li", { hasText: "レポート執筆" });
    await expect(item.getByText("⏱ 1時間30分")).toBeVisible();
  });
});

test.describe("締切と複数リマインダー", () => {
  test("締切を設定でき、期日には複数のリマインダーを選べる", async ({ page }) => {
    await register(page);
    await addTask(page, "確定申告");
    await openTask(page, "確定申告");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });

    // 期日を設定するとリマインダーの選択肢が現れる
    await dialog.getByRole("button", { name: "未設定" }).first().click();
    await dialog.getByRole("button", { name: "20", exact: true }).click();
    await dialog.getByRole("button", { name: "1時間前" }).click();
    await dialog.getByRole("button", { name: "1日前" }).click();

    // 締切(期日とは別項目)も設定する
    await dialog.getByText("締切", { exact: true }).locator("..").getByRole("button", { name: "未設定" }).click();
    await dialog.getByRole("button", { name: "20", exact: true }).click();

    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    const item = page.locator("li", { hasText: "確定申告" });
    await expect(item.getByText("🚩")).toBeVisible();

    // 再度開くと選択したリマインダーが保持されている
    await openTask(page, "確定申告");
    const reopened = page.getByRole("dialog", { name: "タスクの詳細" });
    await expect(reopened.getByRole("button", { name: "1時間前" })).toHaveClass(/bg-accent/);
    await expect(reopened.getByRole("button", { name: "1日前" })).toHaveClass(/bg-accent/);
  });
});

test.describe("担当者割り当て", () => {
  test("2人以上のワークスペースでタスクに担当者を割り当てられる", async ({
    page,
    browser,
  }) => {
    const ownerName = `オーナー${uniqueSuffix()}`;
    await register(page, ownerName);
    const wsName = `共同作業${uniqueSuffix()}`;
    await createSharedWorkspace(page, wsName);

    const inviteUrl = await getInviteUrl(page);
    await page.keyboard.press("Escape");

    const context2 = await browser.newContext();
    const memberName = `メンバー${uniqueSuffix()}`;
    const memberPage = await joinAsNewMember(context2, inviteUrl, memberName);

    // メンバー一覧を owner 側に反映させる
    await page.reload();
    await expect(page.getByRole("heading", { name: wsName })).toBeVisible();

    await addTask(page, "デザインレビュー");
    await openTask(page, "デザインレビュー");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });
    await dialog.getByLabel("担当者").selectOption({ label: memberName });
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    const item = page.locator("li", { hasText: "デザインレビュー" });
    await expect(item.getByTitle(memberName)).toBeVisible();

    await context2.close();
  });
});
