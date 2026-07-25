// テスト段階などで、登録・ログインできる相手を特定のメールアドレスだけに絞るための
// 招待制ゲート。`ALLOWED_EMAILS` が未設定(空文字含む)なら制限なし(従来通りの挙動)。
// 設定されている場合のみ、カンマまたは改行区切りのリストに含まれるメールアドレス
// (大文字小文字・前後の空白は無視)だけを許可する。
//
// 本番(Cloudflare Workers)では `wrangler secret put ALLOWED_EMAILS` で設定する
// (リポジトリにはコミットしない秘匿情報として扱う)。ローカル開発・CI/E2Eでは
// 未設定のままにしておけば、これまで通り誰でも登録できる。

function parseAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[,\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  if (!raw.trim()) return true;
  return parseAllowlist(raw).has(email.trim().toLowerCase());
}
