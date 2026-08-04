// リッチテキスト(メモ・コメント)の共通設定と、DOM に依存しない純粋な文字列処理。
// jsdom や DOMPurify には依存しないため、クライアント/サーバーどちらからでも安全に import できる。

/** 保存・表示を許可するタグ。 */
export const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "s",
  "ul",
  "ol",
  "li",
  "a",
] as const;

/** 保存・表示を許可する属性。 */
export const RICH_TEXT_ALLOWED_ATTR = ["href", "target", "rel"] as const;

/** リンクとして許可するプロトコル。javascript: や data: などは弾く。 */
export const RICH_TEXT_ALLOWED_URI_REGEXP =
  /^(?:https?|mailto|tel):/i;

/** 文字列が(プレーンテキストではなく)HTML タグを含んでいそうかどうか。 */
export function looksLikeHtml(raw: string): boolean {
  return /<[a-z][\s\S]*>/i.test(raw);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 既存の保存済みプレーンテキスト(改行のみで装飾のない文字列)を、
 * リッチテキストエディタ/ビューアーが解釈できる最小限の HTML に変換する。
 * 空行は `<p><br></p>` として段落の空行を保つ。
 */
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => {
      const escaped = escapeHtml(line);
      return `<p>${escaped || "<br>"}</p>`;
    })
    .join("");
}

/**
 * 表示・保存済みかを問わない文字列を、常に HTML として扱えるよう正規化する。
 * すでに HTML なら(サニタイズ前提で)そのまま、プレーンテキストなら `plainTextToHtml` する。
 */
export function normalizeRichText(raw: string): string {
  if (!raw) return "";
  return looksLikeHtml(raw) ? raw : plainTextToHtml(raw);
}

/**
 * HTML からタグを取り除いたプレーンテキストを取り出す(検索・カレンダー連携など、
 * セキュリティ上重要ではない用途向けの簡易実装)。厳密な HTML パースは行わない。
 */
export function stripTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** リッチテキストの内容が実質的に空(タグのみ・空文字)かどうか。 */
export function isEmptyRichText(html: string): boolean {
  return stripTags(html).length === 0;
}
