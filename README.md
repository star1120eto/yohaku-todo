# Yohaku ToDo

余白を大切にする、シンプルで静かな ToDo アプリです。

Web (PWA) をベースに、Capacitor で iOS / Android アプリとしても配信できる構成になっています。

## 機能

- **アカウント登録** — メールアドレス + パスワードで登録・ログイン
- **シンプルな ToDo** — 追加・完了・編集・削除・メモ
- **日時指定の通知** — 期日になるとブラウザ通知でお知らせ
- **Slack通知** — Incoming Webhook を設定すると、ブラウザ通知に加えて Slack にも送信
- **ダークモード** — 設定からライト / ダーク / 端末に合わせる を選択
- **カレンダーで日付選択** — タスク詳細のカレンダーから期日を指定(日曜は赤・土曜は青)
- **優先度づけ** — 高・中・低の 3 段階(色付きドットで控えめに表示)
- **タグ付け** — 複数タグ・タグでの絞り込み
- **フォルダわけ** — ワークスペース内をフォルダで整理
- **ワークスペースわけ** — 複数のワークスペースを切り替え
- **プライベートスペース** — 登録時に共有不可の個人スペース「プライベート」を自動作成
- **ワークスペースごとの共有** — 招待リンク / 招待コードでメンバーを招待、メンバー管理(プライベートは共有不可)
- **指定場所での通知** — 現在地・住所検索・緯度経度の手入力で場所(+ 半径)を登録すると、近づいたときに通知
- **繰り返し通知** — 毎日・毎週・毎月・毎月第N◯曜。完了すると次回の予定日へ自動で進む
- **タイトルの自動解析** — タイトルに書くだけで日時・曜日・優先度・タグ・フォルダを設定

### タイトルの自動解析

入力例:

```
企画書を出す 明日 15:00 #仕事 !高 @案件A
ゴミ出し 毎週土曜5時 #生活
資料提出 毎月第一金曜10時 #仕事 !高
```

| 書き方 | 意味 |
| --- | --- |
| `#タグ名` | タグを付ける |
| `!高` `!中` `!低` (`!1`〜`!3`, `!high` など) | 優先度を設定 |
| `@フォルダ名` | フォルダに入れる(なければ作成) |
| `今日` `明日` `明後日` `来週` | 日付を設定 |
| `土曜` `土曜日` `金曜` など | 曜日を設定(次のその曜日) |
| `6/15` `2026-06-15` | 日付を設定 |
| `15:00` `15時30分` `5時` | 時刻を設定 |
| `毎日` `毎週` `毎月` (`daily` など) | 繰り返しを設定 |
| `毎週土曜` `毎週金曜19時` | 毎週、指定曜日に繰り返し |
| `毎月第一金曜` `毎月最終金曜17時` | 毎月、第N(または最終)の指定曜日に繰り返し |

接頭語(`#` `!` `@`)は **設定画面から好きな記号に変更** できます。日時の自動解析はオフにもできます。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。データはローカルの Cloudflare D1(`.wrangler/` 以下)に保存されます。
外部サービスへの依存はありません。

### 共有を試す

1. ブラウザ A でアカウント登録し、共有したいワークスペースを新規作成(「プライベート」は共有不可)
2. サイドバーのワークスペース横の共有アイコンから招待リンクをコピー
3. 別のブラウザ(またはシークレットウィンドウ)でリンクを開いてアカウント登録すると、同じワークスペースに参加できます

### 通知について

- 設定画面の「ブラウザ通知を許可する」を押して通知を許可してください
- 期日通知・場所通知はアプリ(タブ)を開いている間に動作します(v1)

### Googleカレンダー連携(任意)

期日のあるタスクの作成・変更・完了・削除を、接続したGoogleカレンダーへ自動反映できます。
利用するには [Google Cloud Console](https://console.cloud.google.com/) でOAuthクライアントを作成し、
以下の環境変数を設定してください(未設定の場合、設定画面に連携メニューは表示されず機能は無効のままです)。

```bash
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_REDIRECT_URI=https://your-deploy-url/api/integrations/google/callback
GCAL_TOKEN_SECRET=十分にランダムな文字列(トークン暗号化用。本番では必須)
```

OAuth同意画面のリダイレクトURIには `GOOGLE_REDIRECT_URI` と同じ値を登録し、
スコープに `calendar.events` を許可してください。

## テスト

単体テスト(Vitest)と E2E テスト(Playwright)を用意しています。
GitHub Actions(`.github/workflows/ci.yml`)で `main` への push と Pull Request 時に自動実行されます。

### 単体テスト(Vitest)

古典学派(Classicist)の方針で書いています。

- 可能な限り**本物のオブジェクト**を使う(モック/スタブは持ち込まない。`db` の永続化も実ファイルシステムで検証)
- 検証するのは**戻り値(結果)や永続化された状態**
- テスト対象は「**振る舞いの単位**」(例: タイトルの自動解析、繰り返しの次回算出、パスワード照合)

対象: `src/lib` の `parse` / `recurrence` / `format` / `password` / `db`(`tests/unit/`)。

```bash
npm test            # 一度だけ実行
npm run test:watch  # 変更を監視して再実行
```

### E2E テスト(Playwright)

本物のアプリをビルドして一時データディレクトリ(`.e2e-data/`)で起動し、ブラウザから
登録 → タスク追加 → 自動解析プレビュー → 完了 → 削除 → ワークスペース作成・切替を検証します(`tests/e2e/`)。

```bash
npx playwright install chromium   # 初回のみ(ブラウザを取得)
npm run test:e2e                  # E2E を実行

# ポート 3000 が使用中の場合は別ポートを指定
PORT=3100 npm run test:e2e
```

> サーバーの起動・停止は Playwright が自動で行います。`CI=1` を付けると HTML レポートを `playwright-report/` に出力します。

## Cloudflare へのデプロイ(無料枠)

[OpenNext for Cloudflare](https://opennext.js.org/cloudflare) を使って Cloudflare Workers 上にデプロイします。
データは Cloudflare D1(無料枠 5GB の SQLite)に保存されるため、外部の DB サービスは不要です。

> `wrangler` が Node.js 22 以上を要求するため、開発・デプロイには Node.js 22+ が必要です。

### 初回セットアップ

```bash
# Cloudflare にログイン
npx wrangler login

# D1 データベースを作成し、出力された database_id を wrangler.jsonc の
# d1_databases[0].database_id に設定する
npx wrangler d1 create yohaku-todo-db
```

テーブルはアプリが初回アクセス時に自動で作成するため、手動でのマイグレーション実行は不要です
(`schema.sql` は参考用。手動で適用したい場合は `npm run cf:d1:migrate:remote` / `cf:d1:migrate:local`)。

### デプロイ

```bash
npm run cf:deploy
```

### ローカルで Cloudflare 環境を再現して確認

```bash
npm run cf:preview   # ビルドして wrangler でプレビュー起動
```

型定義(`worker-configuration.d.ts`)が必要な場合は `npm run cf:typegen` で生成できます
(Next.js の DOM 型と衝突するため、生成物はコミットせず `.gitignore` 済みです)。

> v1 は実装の単純さを優先し、アプリの全データを D1 の 1 行に JSON として保存しています
> (旧・JSON ファイルストアの D1 への素直な移行)。同時書き込みは最後に保存した内容で
> 上書きされるため、アクセスが増えてきたら `users` / `workspaces` / `tasks` 等のテーブルに
> 正規化することを推奨します。

## iOS / Android アプリ (Capacitor)

Web アプリをネイティブシェルで包む構成です。デプロイ済みの URL を `CAP_SERVER_URL` に指定して同期します。

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
CAP_SERVER_URL=https://your-deploy-url npx cap sync
npx cap open ios      # Xcode (macOS が必要)
npx cap open android  # Android Studio
```

ネイティブのプッシュ通知・ジオフェンスへ拡張する場合は `@capacitor/push-notifications` / `@capacitor/geolocation` を追加してください。

## アーキテクチャ

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- API は Next.js Route Handlers (`src/app/api/*`)
- データ層は `src/lib/db.ts` に閉じ込めてあり、Cloudflare D1(SQLite)に JSON ブロブとして保存する。将来テーブルへの正規化や他 DB への差し替えも可能
- 認証はメールアドレス + パスワード(Web Crypto の PBKDF2 でハッシュ化、Cookie セッション)
- Cloudflare Workers 上での実行は [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)(`open-next.config.ts` / `wrangler.jsonc`)を使用
- タイトル解析は `src/lib/parse.ts`(クライアントでプレビュー、保存時に構造化)
