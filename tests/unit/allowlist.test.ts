import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isEmailAllowed } from "@/lib/allowlist";

describe("isEmailAllowed", () => {
  const original = process.env.ALLOWED_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.ALLOWED_EMAILS;
    else process.env.ALLOWED_EMAILS = original;
  });

  it("ALLOWED_EMAILS が未設定なら誰でも許可される", () => {
    delete process.env.ALLOWED_EMAILS;
    expect(isEmailAllowed("anyone@example.com")).toBe(true);
  });

  it("ALLOWED_EMAILS が空文字なら誰でも許可される", () => {
    process.env.ALLOWED_EMAILS = "   ";
    expect(isEmailAllowed("anyone@example.com")).toBe(true);
  });

  it("設定されている場合、リストに含まれるメールアドレスのみ許可される", () => {
    process.env.ALLOWED_EMAILS = "a@example.com,b@example.com";
    expect(isEmailAllowed("a@example.com")).toBe(true);
    expect(isEmailAllowed("b@example.com")).toBe(true);
    expect(isEmailAllowed("c@example.com")).toBe(false);
  });

  it("大文字・小文字の違いを無視して照合する", () => {
    process.env.ALLOWED_EMAILS = "Tester@Example.com";
    expect(isEmailAllowed("tester@example.com")).toBe(true);
    expect(isEmailAllowed("TESTER@EXAMPLE.COM")).toBe(true);
  });

  it("各エントリ・入力値の前後の空白を無視する", () => {
    process.env.ALLOWED_EMAILS = "  a@example.com , b@example.com  ";
    expect(isEmailAllowed("  a@example.com  ")).toBe(true);
  });

  it("改行区切りにも対応する", () => {
    process.env.ALLOWED_EMAILS = "a@example.com\nb@example.com\n";
    expect(isEmailAllowed("b@example.com")).toBe(true);
    expect(isEmailAllowed("c@example.com")).toBe(false);
  });

  it("カンマと改行が混在していても対応する", () => {
    process.env.ALLOWED_EMAILS = "a@example.com,b@example.com\nc@example.com";
    expect(isEmailAllowed("c@example.com")).toBe(true);
  });
});
