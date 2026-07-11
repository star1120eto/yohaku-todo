---
name: verify
description: Build and run よはく(yohaku-todo)against the real Cloudflare Workers runtime, then drive it with a real browser to observe behavior.
---

# よはく(yohaku-todo) 動作確認レシピ

## ビルド・起動

本番相当のCloudflare Workersランタイム(wrangler dev + D1)で動かす。
`next start`ではOpenNextの開発用プロキシ経由になり本番と挙動が変わるため使わない。

```bash
rm -rf .wrangler                 # 前回実行のロックが残っているとSQLITE_BUSYで起動失敗することがある
npx opennextjs-cloudflare build
mkdir -p /tmp/verify-data         # 動作確認用に隔離したD1永続化ディレクトリ
nohup npx wrangler dev --port 3200 --persist-to /tmp/verify-data > /tmp/wrangler.log 2>&1 &
echo $! > /tmp/wrangler.pid
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3200/   # 200 になれば起動完了
```

終了時: `kill $(cat /tmp/wrangler.pid)` と `rm -rf .wrangler /tmp/verify-data`。

## ブラウザで駆動する

このサンドボックスのPlaywrightは `/opt/pw-browsers/chromium` を使う
(`playwright install` は実行しない、既にインストール済み)。

```js
import { chromium } from "@playwright/test"; // node_modules配下で解決させるため
                                              // スクリプトは必ずリポジトリ直下に置いて実行する
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext({ acceptDownloads: true }); // ダウンロードを伴う機能の検証に必要
```

register: `page.goto("http://localhost:3200/")` → `メールアドレス`/`パスワード`placeholderを埋め →
「アカウントを作成」クリック → `input[placeholder*="タスクを追加"]` が出れば完了。

## 既知の環境固有の癖(アプリのバグではない)

- **ダウンロードファイル名**: このサンドボックスのChromiumビルドは、`Content-Disposition`の
  `filename*=UTF-8''...`にマルチバイトUTF-8(日本語など)のパーセントエンコードが含まれると
  `download.suggestedFilename()`が`"download"`になる(プレーンASCIIやASCIIのパーセントエンコードは
  正しく解釈される)。実際のファイル内容は影響を受けない。ファイル名を厳密に検証するテストでは
  ASCIIの名前を使うか、この既知の制限として無視すること。
- `.wrangler`ディレクトリが前回のプロセスから残っていると`SQLITE_BUSY`で起動に失敗することがある。
  起動前に必ず`rm -rf .wrangler`する。

## テストで使えるサンプルCSV(TickTick形式)

`tests/e2e/import-export.spec.ts`のSAMPLE_CSVを参照。列は
`TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG`。
