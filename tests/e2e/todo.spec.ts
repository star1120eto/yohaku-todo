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

  // 入力中に解析プレビューが出る
  const preview = page.getByTestId("composer-preview");
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

test("絵文字から置き換えたアイコンが各所に表示される", async ({ page }) => {
  await register(page);

  // Composer: プレビューに矢印・所要時間アイコンが表示される
  const input = page.getByPlaceholder(/タスクを追加/);
  await input.fill("運動 2時間");
  const preview = page.getByTestId("composer-preview");
  await expect(preview.locator("svg").first()).toBeVisible();
  await input.press("Enter");

  // タスク一覧: 所要時間バッジにアイコンが表示される
  const item = page.locator("li").filter({ hasText: "運動" });
  await expect(item.locator("svg")).toBeVisible();
  await expect(item.getByText("2時間")).toBeVisible();

  // タスク詳細: 添付ボタンがアイコンのみでもアクセシブルネームを持つ
  await item.getByText("運動").click();
  await expect(page.getByLabel("ファイルを添付")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル" }).click();

  // 表示切替ボタン: カレンダー⇄リストの切替でアイコン付きラベルに変わる
  const toggleBtn = page.getByRole("button", { name: "カレンダー" });
  await expect(toggleBtn.locator("svg")).toBeVisible();
  await toggleBtn.click();
  await expect(page.getByRole("button", { name: "リスト" })).toBeVisible();
  await page.getByRole("button", { name: "リスト" }).click();

  // サイドバー: フォルダ作成時にアイコン付きの行が表示され、長い名前でも省略記号が付く
  await page.getByTitle("フォルダを追加").click();
  const longName = "とても長いフォルダ名のテストケースを確認するためのラベル";
  await page.getByPlaceholder("フォルダ名").fill(longName);
  await page.getByPlaceholder("フォルダ名").press("Enter");
  const folderRow = page.getByRole("button", { name: longName });
  await expect(folderRow.locator("svg")).toBeVisible();
  // 長い名前を持つテキスト部分が、実際に幅より広い(=省略記号で丸められる)ことを確認する
  const nameLabel = folderRow.locator("span.truncate");
  const overflow = await nameLabel.evaluate(
    (el) => el.scrollWidth > el.clientWidth
  );
  expect(overflow).toBe(true);
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
