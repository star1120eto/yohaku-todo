import { defineConfig, devices } from "@playwright/test";

// E2E は本番と同じ Cloudflare Workers ランタイム(wrangler dev + D1)で
// 本物のアプリを起動して検証する。`next start`(Node ランタイム)は
// OpenNext の開発用プロキシ経由になり本番の挙動と異なるため使わない。
// 外部サービス依存はなく、データは YOHAKU_DATA_DIR 配下のローカル D1 に隔離される。
// ポートは PORT 環境変数で変更可能(既定 3000。ローカルで占有時は PORT=3100 等)。
const PORT = Number(process.env.PORT) || 3000;
const baseURL = `http://localhost:${PORT}`;
const DATA_DIR = process.env.YOHAKU_DATA_DIR || ".e2e-data";

// アクセス制限(ALLOWED_EMAILS)専用の2台目のサーバー。メインのサーバーは
// 誰でも登録できる前提のテストが大半のため、制限を有効にした状態は
// 別ポート・別D1で隔離して検証する(`--var` は wrangler dev にのみ渡り、
// シェルの環境変数をそのまま workerd へは転送しないため必須)。
const ALLOWLIST_PORT = Number(process.env.ALLOWLIST_PORT) || 3001;
export const allowlistBaseURL = `http://localhost:${ALLOWLIST_PORT}`;
const ALLOWLIST_DATA_DIR = process.env.ALLOWLIST_YOHAKU_DATA_DIR || ".e2e-data-allowlist";
const ALLOWLIST_EMAIL = "allowed-tester@example.com";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // wrangler dev 経由のローカル D1 はネイティブ実行より遅くなることがあるため、既定より少し長めに待つ
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `npx opennextjs-cloudflare build && npx wrangler dev --port ${PORT} --persist-to ${DATA_DIR}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // ビルド成果物(.open-next/worker.js)は1台目のサーバーが作るため、
      // 二重ビルドによる書き込み競合を避けてできあがるまで待ってから起動する。
      command: `until [ -f .open-next/worker.js ]; do sleep 1; done; npx wrangler dev --port ${ALLOWLIST_PORT} --persist-to ${ALLOWLIST_DATA_DIR} --var ALLOWED_EMAILS:${ALLOWLIST_EMAIL}`,
      url: allowlistBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});

