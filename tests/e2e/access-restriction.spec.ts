import { test, expect } from "@playwright/test";

// このファイルだけ、ALLOWED_EMAILS を設定した専用サーバー(playwright.config.ts の
// 2台目のwebServer)に対して実行する。メインサーバーは誰でも登録できる前提の
// 他の大量のテストが動くため、制限を有効にした状態はポートを分けて隔離している。
const ALLOWLIST_PORT = Number(process.env.ALLOWLIST_PORT) || 3001;
const baseURL = `http://localhost:${ALLOWLIST_PORT}`;
const ALLOWED_EMAIL = "allowed-tester@example.com";

test.use({ baseURL });

test.describe("アクセス制限(ALLOWED_EMAILS)", () => {
  test("許可リストに無いメールアドレスは新規登録できない", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("メールアドレス").fill("uninvited@example.com");
    await page.getByPlaceholder(/パスワード/).fill("password123");
    await page.getByRole("button", { name: "アカウントを作成" }).click();
    await expect(page.getByText("現在は招待されたメールアドレスのみ登録できます")).toBeVisible();
    // タスク追加欄(ログイン後の画面)には遷移していない
    await expect(page.getByPlaceholder(/タスクを追加/)).toBeHidden();
  });

  test("許可リストにあるメールアドレスは登録・ログインできる", async ({ page, request }) => {
    await page.goto("/");
    await page.getByPlaceholder("メールアドレス").fill(ALLOWED_EMAIL);
    await page.getByPlaceholder(/パスワード/).fill("password123");
    await page.getByRole("button", { name: "アカウントを作成" }).click();
    await expect(page.getByPlaceholder(/タスクを追加/)).toBeVisible();

    // 直接APIを叩いても、許可リストにあるメールアドレスなら通常通りログインできる
    const loginRes = await request.post("/api/auth/login", {
      data: { email: ALLOWED_EMAIL, password: "password123" },
    });
    expect(loginRes.status()).toBe(200);
  });

  // 「登録時は許可されていたが、後にALLOWED_EMAILSから外れた既存アカウントは
  // 正しいパスワードでもログインできない」というログイン側のガードは、
  // このテストサーバーでは対象アカウントをそもそも登録できず再現できないため、
  // src/lib/allowlist.ts のisEmailAllowed()の単体テスト(tests/unit/allowlist.test.ts)と
  // login/route.ts のコードレビューで担保している(register/loginとも同じ関数を使う一箇所のガードのため)。
});
