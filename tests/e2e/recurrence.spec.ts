import { test, expect } from "@playwright/test";
import { register, addTask, openTask } from "./helpers";

test.describe("繰り返しタスク", () => {
  test("完了にしても完了済みへは移動せず、期日が進みサブタスクは未完了に戻る", async ({
    page,
  }) => {
    await register(page);
    await addTask(page, "掃除する");
    await openTask(page, "掃除する");
    const dialog = page.getByRole("dialog", { name: "タスクの詳細" });

    await dialog.getByPlaceholder("サブタスクを追加").fill("床を拭く");
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog.getByText("0/1")).toBeVisible();
    await dialog
      .locator("li", { hasText: "床を拭く" })
      .getByRole("button", { name: "完了にする" })
      .click();
    await expect(dialog.getByText("1/1")).toBeVisible();

    await dialog.getByRole("button", { name: "未設定" }).first().click();
    await dialog.getByRole("button", { name: "20", exact: true }).click();
    await dialog.getByLabel("繰り返し").selectOption({ label: "毎日" });
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    const item = page.locator("li", { hasText: "掃除する" });
    await expect(item.getByText("↻ 毎日")).toBeVisible();
    // 完了済みのサブタスクは(アクティブ/完了済みで別ツリーのため)ここでは
    // カウントされず、親の子タスクバッジはまだ表示されない
    await expect(item.getByText(/^\d+\/\d+$/)).toBeHidden();
    const beforeText = await item.textContent();

    // 繰り返しタスクを完了にしても、通常のタスクのように完了済みへは移動しない
    await item.getByRole("button", { name: "完了にする" }).click();

    // 期日が次の日へ進む(表示が変わるまで待つ)
    await expect.poll(() => item.textContent()).not.toBe(beforeText);
    await expect(item.getByRole("button", { name: "完了にする" })).toBeVisible();

    // サブタスクが未完了に戻り、親と同じアクティブ一覧に入るため子タスクバッジが現れる
    await expect(item.getByText("0/1")).toBeVisible();

    // サブタスク自体も未完了に戻っている
    await openTask(page, "掃除する");
    const reopened = page.getByRole("dialog", { name: "タスクの詳細" });
    await expect(
      reopened.locator("li", { hasText: "床を拭く" }).getByRole("button", { name: "完了にする" })
    ).toBeVisible();
  });
});
