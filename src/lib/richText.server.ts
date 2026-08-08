import { parseHTML } from "linkedom";
import {
  RICH_TEXT_ALLOWED_ATTR,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URI_REGEXP,
  normalizeRichText,
} from "./richTextConfig";

// サーバー専用。API ルートなど、クライアントバンドルに含まれないコードからのみ
// import すること(RichTextEditor / RichTextViewer からは import しない)。
//
// クライアント側(sanitizeClient.ts)はブラウザの本物のDOMPurifyを使うが、
// サーバー側はそれができない: 本番実行環境の Cloudflare Workers(workerd)は
// jsdom(ネイティブAPI依存)を実行できず、代替のWorkers対応DOM実装である
// linkedom は `document.implementation.createHTMLDocument` を提供しないため
// DOMPurify がサポート対象外と判定し、サニタイズをスキップして入力をそのまま
// 返してしまう(サイレントなセキュリティ上の欠陥になる)。
// そのため、ここでは許可タグ・属性が数個に限定されていることを利用し、
// linkedom のDOM APIで直接ツリーを歩いて安全側に倒すサニタイザーを自前で持つ。

const ALLOWED_TAGS = new Set<string>(RICH_TEXT_ALLOWED_TAGS);
const ALLOWED_ATTR = new Set<string>(RICH_TEXT_ALLOWED_ATTR);
// content自体を残す意味が無い(むしろ危険な)要素は、タグだけでなく中身ごと除去する。
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "title",
  "textarea",
  "svg",
  "math",
]);

// U+0000-U+001F(制御文字)と U+007F(DEL)。`java` + TAB + `script:` のような
// 難読化バイパス対策として、href判定の前にこれらを取り除く。
const CONTROL_CHAR_CODES = new Set<number>([
  ...Array.from({ length: 0x20 }, (_, i) => i),
  0x7f,
]);

function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    if (!CONTROL_CHAR_CODES.has(ch.charCodeAt(0))) out += ch;
  }
  return out;
}

function sanitizeHref(raw: string): string | null {
  const cleaned = stripControlChars(raw).trim();
  return RICH_TEXT_ALLOWED_URI_REGEXP.test(cleaned) ? cleaned : null;
}

function sanitizeChildren(parent: Element | DocumentFragment): void {
  // ライブな NodeList を操作しながら移動/削除すると反復がずれるため、事前にスナップショットを取る。
  const children = Array.from(parent.childNodes);
  for (const node of children) {
    const nodeType = node.nodeType;
    if (nodeType === 3 /* TEXT_NODE */) continue; // テキストはそのまま安全
    if (nodeType !== 1 /* ELEMENT_NODE */) {
      // コメント等は不要なので除去
      parent.removeChild(node);
      continue;
    }

    const el = node as unknown as Element;
    const tag = el.tagName.toLowerCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      parent.removeChild(node);
      continue;
    }

    // 先に子要素を再帰的にサニタイズしてから、このタグ自体を許可するか判定する。
    sanitizeChildren(el as unknown as Element | DocumentFragment);

    if (!ALLOWED_TAGS.has(tag)) {
      // 許可外だが危険ではないタグ(div/span 等)は、中身(既にサニタイズ済み)だけ残して展開する。
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTR.has(name)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === "a") {
      const href = el.getAttribute("href");
      const safeHref = href == null ? null : sanitizeHref(href);
      if (safeHref) {
        el.setAttribute("href", safeHref);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      } else {
        el.removeAttribute("href");
        el.removeAttribute("target");
        el.removeAttribute("rel");
      }
    }
  }
}

/**
 * メモ・コメント本文をサニタイズする(信頼できない入力を前提とした唯一の安全境界)。
 * 許可タグ・属性・プロトコル以外はすべて除去される。
 */
export function sanitizeRichText(raw: string): string {
  const html = normalizeRichText(raw);
  if (!html) return "";
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  sanitizeChildren(document.body as unknown as Element | DocumentFragment);
  return document.body.innerHTML;
}

export { isEmptyRichText, stripTags } from "./richTextConfig";
