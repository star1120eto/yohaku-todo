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

test.describe("ロール権限管理とアクティビティログ", () => {
  test("閲覧のみ権限のメンバーは追加・編集ができず、完了の切り替えだけできる", async ({
    page,
    browser,
  }) => {
    const ownerName = `オーナー${uniqueSuffix()}`;
    await register(page, ownerName);
    const wsName = `共有管理${uniqueSuffix()}`;
    await createSharedWorkspace(page, wsName);
    await addTask(page, "共有タスク");

    const inviteUrl = await getInviteUrl(page);
    const context2 = await browser.newContext();
    const memberName = `メンバー${uniqueSuffix()}`;
    const memberPage = await joinAsNewMember(context2, inviteUrl, memberName);

    // オーナー側でメンバー一覧を反映させ、ロールを「閲覧のみ」に変更する
    await page.reload();
    await page.getByTitle("共有").click();
    const shareDialog = page.getByRole("dialog", { name: `「${wsName}」を共有` });
    await expect(shareDialog.getByText(memberName)).toBeVisible();
    await shareDialog
      .locator("li", { hasText: memberName })
      .getByRole("combobox")
      .selectOption("viewer");

    // アクティビティタブで、これまでの操作が記録されていることを確認する
    await shareDialog.getByRole("button", { name: "アクティビティ" }).click();
    await expect(shareDialog.getByText(/を作成/).first()).toBeVisible();
    await page.keyboard.press("Escape");

    // メンバー側に反映させる
    await memberPage.reload();
    await expect(
      memberPage.getByText("閲覧のみの権限です。タスクの完了/未完了は変更できます。")
    ).toBeVisible();
    await expect(memberPage.getByPlaceholder(/タスクを追加/)).toBeHidden();

    // 完了の切り替えだけはできる
    await memberPage
      .locator("li", { hasText: "共有タスク" })
      .getByRole("button", { name: "完了にする" })
      .click();
    await expect(memberPage.getByText(/完了済み（1）/)).toBeVisible();

    // タスク詳細を開いても編集フィールドは無効化され、削除ボタンも無い
    await memberPage.getByText("完了済み").click();
    await memberPage.getByText("共有タスク").click();
    const memberDialog = memberPage.getByRole("dialog", { name: "タスクの詳細" });
    await expect(memberDialog.getByText("閲覧のみの権限です")).toBeVisible();
    await expect(memberDialog.getByRole("button", { name: "削除" })).toBeHidden();
    await expect(memberDialog.getByRole("button", { name: "保存" })).toBeHidden();

    await context2.close();
  });
});

test.describe("コメント・添付ファイル", () => {
  test("コメントを投稿してファイルを添付でき、自分のコメントだけ削除できる", async ({
    page,
    browser,
  }) => {
    const ownerName = `オーナー${uniqueSuffix()}`;
    await register(page, ownerName);
    const wsName = `コメント検証${uniqueSuffix()}`;
    await createSharedWorkspace(page, wsName);
    await addTask(page, "見積書を確認する");

    const inviteUrl = await getInviteUrl(page);
    await page.keyboard.press("Escape");
    const context2 = await browser.newContext();
    const memberName = `レビュワー${uniqueSuffix()}`;
    const memberPage = await joinAsNewMember(context2, inviteUrl, memberName);
    await memberPage.reload();

    await openTask(page, "見積書を確認する");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({
        name: "note.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("補足資料です"),
      });
    await expect(dialog.getByText("note.txt")).toBeVisible();
    await dialog
      .getByPlaceholder(/コメントを入力/)
      .fill("金額を確認してください");
    await dialog.getByRole("button", { name: "送信" }).click();
    await expect(dialog.getByText("金額を確認してください")).toBeVisible();
    await expect(dialog.getByText("📎 note.txt")).toBeVisible();
    await page.keyboard.press("Escape");

    // 一覧のコメント数バッジに反映される
    await expect(page.locator("li", { hasText: "見積書を確認する" }).getByText("💬 1")).toBeVisible();

    // 別メンバーもコメントできるが、他人のコメントは削除できない
    await memberPage.getByText("見積書を確認する").click();
    const memberDialog = memberPage.getByRole("dialog", { name: "タスクの詳細" });
    await expect(memberDialog.getByText("金額を確認してください")).toBeVisible();
    await expect(
      memberDialog.locator("li", { hasText: "金額を確認してください" }).getByRole("button", { name: "削除" })
    ).toBeHidden();
    await memberDialog.getByPlaceholder(/コメントを入力/).fill("確認しました");
    await memberDialog.getByRole("button", { name: "送信" }).click();
    await expect(memberDialog.getByText("確認しました")).toBeVisible();
    await memberPage.keyboard.press("Escape");

    // 投稿者本人は自分のコメントを削除できる
    await openTask(page, "見積書を確認する");
    const dialog2 = page.getByRole("dialog", { name: "タスクの詳細" });
    await dialog2
      .locator("li", { hasText: "金額を確認してください" })
      .getByRole("button", { name: "削除" })
      .click();
    await expect(dialog2.getByText("金額を確認してください")).toBeHidden();
    await expect(dialog2.getByText("確認しました")).toBeVisible();

    await context2.close();
  });
});
