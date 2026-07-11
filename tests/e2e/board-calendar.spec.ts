import { test, expect } from "@playwright/test";
import { register, addTask, fillAndSubmit, uniqueSuffix } from "./helpers";

test.describe("ボード表示のドラッグ&ドロップ", () => {
  test("カードを別のセクションへドラッグして移動できる", async ({ page }) => {
    await register(page);
    const folderName = `かんばん${uniqueSuffix()}`;
    await page.getByTitle("フォルダを追加").click();
    await fillAndSubmit(page.getByPlaceholder("フォルダ名"), folderName);
    await page.getByRole("button", { name: `📁 ${folderName}` }).click();
    await expect(page.getByRole("heading", { name: folderName })).toBeVisible();

    await addTask(page, "設計を見直す");

    await page.getByRole("button", { name: "＋ セクション" }).click();
    await fillAndSubmit(page.getByPlaceholder("セクション名"), "進行中");
    await expect(page.getByRole("button", { name: "進行中" })).toBeVisible();

    await page.getByRole("button", { name: "▦ ボード" }).click();

    const noSectionColumn = page.locator(".shrink-0.w-64", { hasText: "セクションなし" });
    const inProgressColumn = page.locator(".shrink-0.w-64", { hasText: "進行中" });
    await expect(noSectionColumn.getByText("設計を見直す")).toBeVisible();
    await expect(inProgressColumn.getByText("設計を見直す")).toBeHidden();

    const card = page.locator(".cursor-pointer.rounded-lg", { hasText: "設計を見直す" });
    await card.dragTo(inProgressColumn);

    await expect(inProgressColumn.getByText("設計を見直す")).toBeVisible();
    await expect(noSectionColumn.getByText("設計を見直す")).toBeHidden();
  });
});

test.describe("カレンダー表示のナビゲーション", () => {
  test("前月・次月・今日への移動と、選択日からのタスク追加ができる", async ({
    page,
  }) => {
    await register(page);
    await page.getByRole("button", { name: "🗓 カレンダー" }).click();

    const monthLabel = page.getByText(/^\d{4}年 \d{1,2}月$/);
    const initialMonth = await monthLabel.textContent();

    await page.getByRole("button", { name: "次の月" }).click();
    await expect(monthLabel).not.toHaveText(initialMonth!);

    await page.getByRole("button", { name: "前の月" }).click();
    await expect(monthLabel).toHaveText(initialMonth!);

    // さらに前月へ移動してから「今日」で当月に戻れる
    await page.getByRole("button", { name: "前の月" }).click();
    await expect(monthLabel).not.toHaveText(initialMonth!);
    await page.getByRole("button", { name: "今日", exact: true }).click();
    await expect(monthLabel).toHaveText(initialMonth!);

    // 今日の日付セルを選び、その日にタスクを追加する
    const today = new Date();
    await page
      .getByRole("button", { name: `${today.getMonth() + 1}月${today.getDate()}日` })
      .click();
    await page
      .getByPlaceholder("この日にタスクを追加")
      .fill("歯医者の予約");
    await page.getByPlaceholder("この日にタスクを追加").press("Enter");

    const taskButton = page.getByRole("button", { name: "歯医者の予約", exact: true });
    await expect(taskButton).toBeVisible();
    await expect(taskButton).not.toHaveClass(/line-through/);

    // 選択日のタスク一覧から完了へ切り替えられる
    await page
      .locator("li", { hasText: "歯医者の予約" })
      .locator("button")
      .first()
      .click();
    await expect(taskButton).toHaveClass(/line-through/);
  });
});
