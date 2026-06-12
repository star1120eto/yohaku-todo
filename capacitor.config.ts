import type { CapacitorConfig } from "@capacitor/cli";

// iOS / Android アプリは、この Web アプリをネイティブシェルで包んで配信する。
// 開発時は server.url をローカル開発サーバーに、
// 本番ではデプロイ先 URL に向けて `npx cap sync` する。
const config: CapacitorConfig = {
  appId: "me.yohaku.todo",
  appName: "余白 ToDo",
  webDir: "public",
  server: {
    url: process.env.CAP_SERVER_URL || "https://yohaku-todo.example.com",
    cleartext: false,
  },
};

export default config;
