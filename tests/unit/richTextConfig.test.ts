import { describe, it, expect } from "vitest";
import {
  looksLikeHtml,
  plainTextToHtml,
  normalizeRichText,
  stripTags,
  isEmptyRichText,
} from "@/lib/richTextConfig";

describe("looksLikeHtml", () => {
  it("HTML タグを含む文字列を検出する", () => {
    expect(looksLikeHtml("<p>hello</p>")).toBe(true);
    expect(looksLikeHtml('<a href="https://example.com">link</a>')).toBe(true);
  });

  it("タグを含まないプレーンテキストは false", () => {
    expect(looksLikeHtml("牛乳を買う")).toBe(false);
    expect(looksLikeHtml("1 < 2 という不等式")).toBe(false);
    expect(looksLikeHtml("")).toBe(false);
  });

  it("既存の保存済みプレーンテキストがタグに似た語句を含んでいても誤検出しない", () => {
    // このエディタが実際には使わないタグ名(script/div/table等)を含む既存のプレーン
    // テキストを、HTML として誤って扱ってしまう(内容が消えたり壊れたりする)ことを防ぐ。
    expect(looksLikeHtml("<script>の使い方について")).toBe(false);
    expect(looksLikeHtml("<div>タグと<span>タグの違い")).toBe(false);
    expect(looksLikeHtml("値段は<table>で管理している")).toBe(false);
  });
});

describe("plainTextToHtml", () => {
  it("各行を段落に変換する", () => {
    expect(plainTextToHtml("買い物\n牛乳と卵")).toBe(
      "<p>買い物</p><p>牛乳と卵</p>"
    );
  });

  it("空行は <p><br></p> になる", () => {
    expect(plainTextToHtml("一行目\n\n三行目")).toBe(
      "<p>一行目</p><p><br></p><p>三行目</p>"
    );
  });

  it("HTML の特殊文字はエスケープする", () => {
    expect(plainTextToHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
    );
  });

  it("空文字は空文字のまま", () => {
    expect(plainTextToHtml("")).toBe("");
  });
});

describe("normalizeRichText", () => {
  it("すでに HTML ならそのまま返す", () => {
    const html = "<p>hello</p>";
    expect(normalizeRichText(html)).toBe(html);
  });

  it("プレーンテキストは HTML に変換する", () => {
    expect(normalizeRichText("メモ書き")).toBe("<p>メモ書き</p>");
  });

  it("空文字は空文字のまま", () => {
    expect(normalizeRichText("")).toBe("");
  });
});

describe("stripTags / isEmptyRichText", () => {
  it("タグを除去してテキストのみ残す", () => {
    expect(stripTags("<p>買い物<strong>忘れずに</strong></p>")).toBe(
      "買い物 忘れずに"
    );
  });

  it("script/style の中身ごと除去する", () => {
    expect(stripTags("<script>alert(1)</script>本文")).toBe("本文");
  });

  it("空段落・改行のみのタグは空扱い", () => {
    expect(isEmptyRichText("<p></p>")).toBe(true);
    expect(isEmptyRichText("<p><br></p>")).toBe(true);
  });

  it("実際の文字が入っていれば空ではない", () => {
    expect(isEmptyRichText("<p>買い物</p>")).toBe(false);
  });
});
