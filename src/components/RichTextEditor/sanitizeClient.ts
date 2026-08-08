import DOMPurify from "dompurify";
import {
  RICH_TEXT_ALLOWED_ATTR,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URI_REGEXP,
} from "@/lib/richTextConfig";

// クライアント専用サニタイザー。jsdom は使わず、ブラウザの DOMPurify を直接使う
// (jsdom をクライアントバンドルへ含めないため、サーバー用の richText.server.ts とは分離している)。
//
// 表示内容は保存時点で既にサーバー側(richText.server.ts)でサニタイズ済みだが、
// 「フロントエンドの検証だけに頼らない」の裏返しとして、表示側でも二重にサニタイズする。
let hooked = false;

function ensureHook() {
  if (hooked || typeof window === "undefined") return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  hooked = true;
}

export function sanitizeForDisplay(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // SSR 時は DOM がなく DOMPurify を実行できない。保存時点で既にサーバー側で
    // サニタイズ済みのデータであることを前提に、そのまま返す(クライアントで再度サニタイズされる)。
    return html;
  }
  ensureHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTR],
    ALLOWED_URI_REGEXP: RICH_TEXT_ALLOWED_URI_REGEXP,
  });
}
