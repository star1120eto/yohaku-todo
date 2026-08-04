import { test, expect, type Page } from "@playwright/test";

// アカウントごとにデータが独立するよう、テストごとに一意のメールで新規登録する。
async function register(page: Page) {
  const email = `e2e-rte-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;
  await page.goto("/");
  await page.getByPlaceholder("メールアドレス").fill(email);
  await page.getByPlaceholder(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();
  return email;
}

async function addTask(page: Page, raw: string) {
  const input = page.getByPlaceholder(/タスクを追加/);
  await input.fill(raw);
  await input.press("Enter");
}

test("メモ欄にURLを入力して保存すると、クリック可能なリンクとして表示される", async ({
  page,
}) => {
  await register(page);
  await addTask(page, "資料を確認する");
  await page.getByText("資料を確認する").click();
  await expect(
    page.getByRole("heading", { name: "タスクの詳細" })
  ).toBeVisible();

  const memo = page.getByRole("textbox", { name: "メモ" });
  await memo.click();
  await memo.pressSequentially("詳細はこちら https://example.com ", { delay: 30 });

  await page.getByRole("button", { name: "保存" }).click();
  await expect(
    page.getByRole("heading", { name: "タスクの詳細" })
  ).toBeHidden();

  // 再度開いて、保存されたメモがリンクとして表示されることを確認する
  await page.getByText("資料を確認する").click();
  const link = page.getByRole("link", { name: /example\.com/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /https:\/\/example\.com/);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("コメント欄にURLを投稿すると、リンクとして表示される", async ({ page }) => {
  await register(page);
  await addTask(page, "打ち合わせ資料");
  await page.getByText("打ち合わせ資料").click();
  await expect(
    page.getByRole("heading", { name: "タスクの詳細" })
  ).toBeVisible();

  const commentBox = page.getByRole("textbox", { name: "コメント" });
  await commentBox.click();
  await commentBox.pressSequentially("参考 https://example.com/doc ", { delay: 30 });
  await page.getByRole("button", { name: "送信" }).click();

  const commentLink = page.getByRole("link", { name: /example\.com\/doc/ });
  await expect(commentLink).toBeVisible();
  await expect(commentLink).toHaveAttribute("target", "_blank");
});

test("http: や mailto: のURLはリンク化されない(httpsのみ許可)", async ({
  page,
}) => {
  await register(page);
  await addTask(page, "許可プロトコルの確認");
  await page.getByText("許可プロトコルの確認").click();
  await expect(
    page.getByRole("heading", { name: "タスクの詳細" })
  ).toBeVisible();

  const memo = page.getByRole("textbox", { name: "メモ" });
  await memo.click();
  await memo.pressSequentially(
    "http://example.com と mailto:test@example.com はリンクにならない ",
    { delay: 30 }
  );

  await page.getByRole("button", { name: "保存" }).click();
  await expect(
    page.getByRole("heading", { name: "タスクの詳細" })
  ).toBeHidden();

  // 再度開いても、httpやmailtoのURLはリンクとして表示されない(テキストのみ)
  await page.getByText("許可プロトコルの確認").click();
  const memoAfterReopen = page.getByRole("textbox", { name: "メモ" });
  await expect(memoAfterReopen).toContainText("http://example.com");
  await expect(memoAfterReopen).toContainText("mailto:test@example.com");
  await expect(memoAfterReopen.locator("a")).toHaveCount(0);
});

test("プレーンテキストのみのメモは、これまで通り表示できる(既存データとの互換性)", async ({
  page,
}) => {
  await register(page);
  await addTask(page, "普通のタスク");
  await page.getByText("普通のタスク").click();
  const memo = page.getByRole("textbox", { name: "メモ" });
  await memo.click();
  await memo.pressSequentially("URLを含まない、ただのメモ");
  await page.getByRole("button", { name: "保存" }).click();

  await page.getByText("普通のタスク").click();
  await expect(
    page.getByText("URLを含まない、ただのメモ")
  ).toBeVisible();
});
