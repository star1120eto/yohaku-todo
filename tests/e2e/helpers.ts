import { type Page, type Locator, type BrowserContext, expect } from "@playwright/test";

// アカウント/ワークスペースごとにデータが独立するよう、呼び出しごとに一意な値を作る。
export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

// 入力→Enter送信の一括ヘルパー。負荷が高いと入力欄の状態更新と競合し、
// 空のまま送信されてしまうことがあるため、送信前に値が確定しているか確認する。
export async function fillAndSubmit(input: Locator, value: string) {
  await input.fill(value);
  await expect(input).toHaveValue(value);
  await input.press("Enter");
}

export async function register(page: Page, name?: string) {
  const suffix = uniqueSuffix();
  const email = `e2e-${suffix}@example.com`;
  await page.goto("/");
  if (name) {
    await page.getByPlaceholder("名前（任意）").fill(name);
  }
  await page.getByPlaceholder("メールアドレス").fill(email);
  await page.getByPlaceholder(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();
  return email;
}

export async function addTask(page: Page, raw: string) {
  const input = page.getByPlaceholder(/タスクを追加/);
  await fillAndSubmit(input, raw);
  await expect(input).toHaveValue("");
}

export async function openTask(page: Page, title: string) {
  await page.getByText(title, { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "タスクの詳細" })).toBeVisible();
}

export async function closeModal(page: Page) {
  await page.keyboard.press("Escape");
}

// 「新規作成」から共有可能なワークスペースを作り、現在のワークスペースに切り替える。
export async function createSharedWorkspace(page: Page, name: string) {
  await page.getByTitle("新規作成").click();
  await page.getByPlaceholder("チームA").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  const wsButton = page.getByRole("button", { name, exact: true });
  await expect(wsButton).toBeVisible();
  await wsButton.click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

// 共有ダイアログを開いて招待URLを取得する(ダイアログは開いたまま返す)
export async function getInviteUrl(page: Page): Promise<string> {
  await page.getByTitle("共有").click();
  const input = page.locator("input[readonly]");
  await expect(input).toBeVisible();
  const url = await input.inputValue();
  return url;
}

// 別のブラウザコンテキストで新規登録し、招待URLから同じワークスペースに参加させる。
export async function joinAsNewMember(
  context: BrowserContext,
  inviteUrl: string,
  name: string
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(inviteUrl);
  await page.getByPlaceholder("名前（任意）").fill(name);
  const suffix = uniqueSuffix();
  await page.getByPlaceholder("メールアドレス").fill(`e2e-${suffix}@example.com`);
  await page.getByPlaceholder(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();
  return page;
}
