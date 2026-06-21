import { defineConfig, devices } from "@playwright/test";

// E2E は本物のアプリ(ビルド済み Next.js)を一時データディレクトリで起動して検証する。
// 外部サービス依存はなく、データは YOHAKU_DATA_DIR 配下の JSON に隔離される。
// ポートは PORT 環境変数で変更可能(既定 3000。ローカルで占有時は PORT=3100 等)。
const PORT = Number(process.env.PORT) || 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { YOHAKU_DATA_DIR: ".e2e-data" },
  },
});
