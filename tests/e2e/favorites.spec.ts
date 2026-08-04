import { test, expect, type Page } from "@playwright/test";

async function register(page: Page) {
  const email = `e2e-fav-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;
  await page.goto("/");
  await page.getByPlaceholder("メールアドレス").fill(email);
  await page.getByPlaceholder(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();
}

async function createFolder(page: Page, name: string) {
  await page.getByTitle("フォルダを追加").click();
  const input = page.getByPlaceholder("フォルダ名");
  await input.fill(name);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
}

async function favoriteFolder(page: Page, name: string) {
  const row = page.locator("li").filter({ hasText: name }).first();
  await row.hover();
  await row.getByTitle("お気に入りに登録").click();
}

async function favoriteLabels(page: Page): Promise<string[]> {
  return page.getByTestId("favorites-list").locator("button").allTextContents();
}

test("お気に入りをドラッグ&ドロップで並び替えられ、再読み込み後も保持される", async ({
  page,
}) => {
  await register(page);

  await createFolder(page, "仕事");
  await createFolder(page, "個人");
  await favoriteFolder(page, "仕事");
  await favoriteFolder(page, "個人");

  // 登録した順(仕事 → 個人)でお気に入りセクションに表示される
  await expect(page.getByTestId("favorites-list")).toBeVisible();
  expect(await favoriteLabels(page)).toEqual(["仕事", "個人"]);

  // 「個人」を「仕事」より上へドラッグして並び替える
  const favList = page.getByTestId("favorites-list");
  const personal = favList.locator("li").filter({ hasText: "個人" });
  const work = favList.locator("li").filter({ hasText: "仕事" });
  await personal.dragTo(work);

  await expect.poll(() => favoriteLabels(page)).toEqual(["個人", "仕事"]);

  // リロードしても並び順(サーバーに保存された order)が保持される
  await page.reload();
  await expect(page.getByTestId("favorites-list")).toBeVisible();
  expect(await favoriteLabels(page)).toEqual(["個人", "仕事"]);
});
