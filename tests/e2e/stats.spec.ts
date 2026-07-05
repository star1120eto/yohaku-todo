import { test, expect } from "@playwright/test";
import { register, addTask } from "./helpers";

test.describe("生産性トレンド(ふりかえり)", () => {
  test("完了したタスクが集計・連続日数に反映される", async ({ page }) => {
    await register(page);

    await page.getByRole("button", { name: "ふりかえり" }).click();
    const dialog = page.getByRole("dialog", { name: "ふりかえり" });
    await expect(dialog.getByText("まだ記録がありません。")).toBeVisible();
    await page.keyboard.press("Escape");

    await addTask(page, "ストレッチする");
    await page.getByRole("button", { name: "完了にする" }).click();

    await page.getByRole("button", { name: "ふりかえり" }).click();
    const reopened = page.getByRole("dialog", { name: "ふりかえり" });
    await expect(reopened.getByText("最長連続 1日 ・ 累計 1件")).toBeVisible();
  });
});
