import { test, expect } from "@playwright/test";
import { register, addTask, fillAndSubmit, uniqueSuffix } from "./helpers";

test.describe("検索", () => {
  test("入力したキーワードに一致するタスクだけ表示される", async ({ page }) => {
    await register(page);
    await addTask(page, "牛乳を買う");
    await addTask(page, "会議の資料を作る");

    await page.getByLabel("検索").click();
    await page.getByPlaceholder("タイトル・メモ・タグで検索").fill("牛乳");

    await expect(page.getByText("牛乳を買う")).toBeVisible();
    await expect(page.getByText("会議の資料を作る")).toBeHidden();
  });
});

test.describe("カスタムフィルター", () => {
  test("条件を組み合わせて作成し、一覧をそのフィルターで絞り込める", async ({
    page,
  }) => {
    await register(page);
    await addTask(page, "!高 至急の電話");
    await addTask(page, "!低 のんびり読書");

    await page.getByTitle("フィルターを作成").click();
    const dialog = page.getByRole("dialog", { name: "フィルターを作成" });
    await dialog.getByPlaceholder("例: 今日の高優先度").fill("高優先度のみ");
    await dialog.getByRole("button", { name: "高", exact: true }).click();
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();

    const filterNav = page.getByRole("button", { name: "🔎 高優先度のみ" });
    await expect(filterNav).toBeVisible();
    await filterNav.click();

    await expect(page.getByRole("heading", { name: "高優先度のみ" })).toBeVisible();
    await expect(page.getByText("至急の電話")).toBeVisible();
    await expect(page.getByText("のんびり読書")).toBeHidden();

    // 編集
    await page.getByTitle("編集").click();
    const editDialog = page.getByRole("dialog", { name: "フィルターを編集" });
    await expect(editDialog.getByPlaceholder("例: 今日の高優先度")).toHaveValue("高優先度のみ");
    await editDialog.getByRole("button", { name: "キャンセル" }).click();

    // 削除
    page.once("dialog", (d) => d.accept());
    await page.getByTitle("削除").click();
    await expect(page.getByRole("button", { name: "🔎 高優先度のみ" })).toBeHidden();
  });
});

test.describe("お気に入り", () => {
  test("フォルダとタグをお気に入り登録・解除できる", async ({ page }) => {
    await register(page);
    const folderName = `買い物${uniqueSuffix()}`;
    await page.getByTitle("フォルダを追加").click();
    await fillAndSubmit(page.getByPlaceholder("フォルダ名"), folderName);
    const folders = page.getByTestId("folders");
    const folderRow = folders.locator("li", { hasText: folderName });
    await expect(folderRow).toBeVisible();

    await folderRow.getByTitle("お気に入りに登録").click();
    const favorites = page.getByTestId("favorites");
    const favNav = favorites.getByRole("button", { name: `📁 ${folderName}` });
    await expect(favNav).toBeVisible();

    // お気に入りから選ぶとそのフォルダに切り替わる
    await favNav.click();
    await expect(page.getByRole("heading", { name: folderName })).toBeVisible();

    // フォルダ一覧側から解除すると、お気に入り一覧から消える
    await folderRow.getByTitle("お気に入りから外す").click();
    await expect(favorites).toBeHidden();
  });
});

test.describe("セクションとボード表示", () => {
  test("セクションを作成し、リスト/ボード表示を切り替えられる", async ({
    page,
  }) => {
    await register(page);
    const folderName = `プロジェクト${uniqueSuffix()}`;
    await page.getByTitle("フォルダを追加").click();
    await fillAndSubmit(page.getByPlaceholder("フォルダ名"), folderName);
    await page.getByRole("button", { name: `📁 ${folderName}` }).click();
    await expect(page.getByRole("heading", { name: folderName })).toBeVisible();

    // セクションは(空のフォルダには何も表示されない仕様のため)先にタスクを1件追加してから作る
    await addTask(page, "画面設計をする");

    await page.getByRole("button", { name: "＋ セクション" }).click();
    const sectionName = "設計";
    await fillAndSubmit(page.getByPlaceholder("セクション名"), sectionName);
    await expect(page.getByRole("button", { name: sectionName })).toBeVisible();

    // ボード表示に切り替えるとかんばん形式のカラムになる
    await page.getByRole("button", { name: "▦ ボード" }).click();
    await expect(page.getByText("画面設計をする")).toBeVisible();

    // ボードのカラムからタスクを追加できる
    await page.getByRole("button", { name: "＋ タスク" }).first().click();
    await fillAndSubmit(page.getByPlaceholder("タスクを追加").last(), "APIを実装する");
    await expect(page.getByText("APIを実装する")).toBeVisible();

    // リスト表示に戻せる
    await page.getByRole("button", { name: "☰ リスト" }).click();
    await expect(page.getByText("APIを実装する")).toBeVisible();
  });
});

test.describe("カレンダー表示", () => {
  test("月表示に切り替えて、日付をクリックするとその日のタスクが見える", async ({
    page,
  }) => {
    await register(page);
    await addTask(page, "歯医者の予約 今日");

    await page.getByRole("button", { name: "🗓 カレンダー" }).click();

    const today = new Date();
    await page
      .getByRole("button", { name: `${today.getMonth() + 1}月${today.getDate()}日` })
      .click();
    // 日付クリックで表示される、その日のタスク一覧(ボタンとして描画される、カレンダーセル内のプレビューとは別)
    await expect(
      page.getByRole("button", { name: "歯医者の予約", exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "☰ リスト" }).click();
    await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();
  });
});
