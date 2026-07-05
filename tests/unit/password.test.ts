import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isValidEmail } from "@/lib/password";

// 本物の Web Crypto (PBKDF2) を使い、ハッシュ化と照合という振る舞いの結果を検証する。
describe("hashPassword / verifyPassword", () => {
  it("ハッシュは salt:hash 形式で、毎回 salt が異なる", async () => {
    const a = await hashPassword("secret123");
    const b = await hashPassword("secret123");
    expect(a).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(a).not.toBe(b); // ランダム salt
  });

  it("正しいパスワードで照合できる", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("誤ったパスワードは拒否する", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });

  it("壊れた保存値は false を返す", async () => {
    expect(await verifyPassword("any", "no-colon")).toBe(false);
    expect(await verifyPassword("any", "")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("妥当なアドレスを受け入れる", () => {
    expect(isValidEmail("a@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@sub.example.co.jp")).toBe(true);
  });

  it("不正なアドレスを拒否する", () => {
    expect(isValidEmail("plainaddress")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});
