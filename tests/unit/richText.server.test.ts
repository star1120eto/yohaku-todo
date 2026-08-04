import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "@/lib/richText.server";

// 本物の DOMPurify + jsdom を使い、サニタイズ後の実際の HTML(状態)を検証する。
describe("sanitizeRichText", () => {
  it("許可タグ(段落・強調・リンク等)はそのまま残す", () => {
    const html = "<p>買い物<strong>忘れずに</strong>と<em>牛乳</em></p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("script タグ・イベントハンドラ属性を除去する", () => {
    const dirty = '<p onclick="alert(1)">こんにちは<script>alert(1)</script></p>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("こんにちは");
  });

  it("style / iframe タグを除去する", () => {
    const dirty = '<p>本文<iframe src="https://evil.example"></iframe></p><style>p{}</style>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("<style");
  });

  it("https リンクは保持し、target=_blank rel=noopener noreferrer を付与する", () => {
    const clean = sanitizeRichText('<p><a href="https://example.com">詳細</a></p>');
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("javascript: / data: / vbscript: リンクは無効化する", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      const clean = sanitizeRichText(`<p><a href="${href}">危険</a></p>`);
      expect(clean).not.toContain(href);
    }
  });

  it("http: / mailto: / tel: リンクは許可しない(https のみ許可)", () => {
    for (const href of ["http://example.com", "mailto:a@example.com", "tel:0312345678"]) {
      const clean = sanitizeRichText(`<p><a href="${href}">リンク</a></p>`);
      expect(clean).not.toContain(href);
    }
  });

  it("既存の保存済みプレーンテキスト(改行あり)は段落に変換されて保存される", () => {
    const clean = sanitizeRichText("買い物\n牛乳と卵");
    expect(clean).toBe("<p>買い物</p><p>牛乳と卵</p>");
  });

  it("空文字は空文字のまま", () => {
    expect(sanitizeRichText("")).toBe("");
  });
});
