import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import {
  RICH_TEXT_ALLOWED_ATTR,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URI_REGEXP,
  normalizeRichText,
} from "./richTextConfig";

// サーバー専用(jsdom 依存)。API ルートなど、クライアントバンドルに含まれない
// コードからのみ import すること。RichTextEditor / RichTextViewer からは import しない。

const { window } = new JSDOM("");
const purify = createDOMPurify(window as unknown as Window & typeof globalThis);

// サニタイズ後、外部リンクには必ず target=_blank / rel=noopener noreferrer を強制する。
purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * メモ・コメント本文をサニタイズする(信頼できない入力を前提とした唯一の安全境界)。
 * 許可タグ・属性・プロトコル以外はすべて除去される。
 */
export function sanitizeRichText(raw: string): string {
  const html = normalizeRichText(raw);
  if (!html) return "";
  return purify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTR],
    ALLOWED_URI_REGEXP: RICH_TEXT_ALLOWED_URI_REGEXP,
  });
}

export { isEmptyRichText, stripTags } from "./richTextConfig";
