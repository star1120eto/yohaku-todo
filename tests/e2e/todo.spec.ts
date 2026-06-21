import { test, expect, type Page } from "@playwright/test";

// アカウントごとにデータが独立するよう、テストごとに一意のメールで新規登録する。
async function register(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;
  await page.goto("/");
  await page.getByPlaceholder("メールアドレス").fill(email);
  await page.getByPlaceholder(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  // ログイン後はプライベートワークスペースとコンポーザーが表示される
  await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();
  return email;
}

async function addTask(page: Page, raw: string) {
  const input = page.getByPlaceholder(/タスクを追加/);
  await input.fill(raw);
  await input.press("Enter");
}

test("新規登録するとアプリに入り、空状態が表示される", async ({ page }) => {
  await register(page);
  await expect(page.getByText("まだタスクがありません。")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "プライベート" })
  ).toBeVisible();
});

test("タスクを追加すると一覧に表示される", async ({ page }) => {
  await register(page);
  await addTask(page, "牛乳を買う");
  await expect(page.getByText("牛乳を買う")).toBeVisible();
  await expect(page.getByText("まだタスクがありません。")).toBeHidden();
});

test("タイトルの自動解析プレビューが表示され、解析結果で保存される", async ({
  page,
}) => {
  await register(page);
  const input = page.getByPlaceholder(/タスクを追加/);
  await input.fill("資料提出 明日 #仕事 !高");

  // 入力中にプレビュー(→)が出る
  const preview = page.locator("form").filter({ hasText: "→" });
  await expect(preview.getByText("資料提出")).toBeVisible();
  await expect(preview.getByText("仕事")).toBeVisible();
  await expect(preview.getByText("高")).toBeVisible();

  await input.press("Enter");

  // 保存後、本文からは接頭語が取り除かれ、タグ「仕事」が付く
  const item = page.locator("li").filter({ hasText: "資料提出" });
  await expect(item).toBeVisible();
  await expect(item.getByText("仕事")).toBeVisible();
});

test("チェックで完了にすると完了済みセクションへ移動する", async ({ page }) => {
  await register(page);
  await addTask(page, "ゴミ出し");
  await expect(page.getByText("ゴミ出し")).toBeVisible();

  await page.getByRole("button", { name: "完了にする" }).click();

  await expect(page.getByText(/完了済み（1）/)).toBeVisible();
});

test("タスク詳細から削除すると一覧から消える", async ({ page }) => {
  await register(page);
  await addTask(page, "不要なタスク");

  await page.getByText("不要なタスク").click();
  await expect(
    page.getByRole("heading", { name: "タスクの詳細" })
  ).toBeVisible();

  await page.getByRole("button", { name: "削除" }).click();

  await expect(page.getByText("不要なタスク")).toBeHidden();
  await expect(page.getByText("まだタスクがありません。")).toBeVisible();
});

test("ワークスペースを作成して切り替えられる", async ({ page }) => {
  await register(page);

  await page.getByTitle("新規作成").click();
  await page.getByPlaceholder("チームA").fill("チームX");
  await page.getByRole("button", { name: "作成" }).click();

  // 作成したワークスペースがサイドバーに現れ、選ぶと見出しが切り替わる
  const wsButton = page.getByRole("button", { name: "チームX" });
  await expect(wsButton).toBeVisible();
  await wsButton.click();
  await expect(
    page.getByRole("heading", { name: "チームX" })
  ).toBeVisible();
});
