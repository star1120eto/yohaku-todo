import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";

// Google連携のトークンなど、機微な文字列を保存前に暗号化するための鍵。
// GCAL_TOKEN_SECRET は本番運用時に必ず設定する(未設定時は開発用の既定値にフォールバック)。
function deriveKey(): Buffer {
  const secret = process.env.GCAL_TOKEN_SECRET || "yohaku-dev-secret-not-for-production";
  return scryptSync(secret, "yohaku-gcal-salt", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(":");
  const decipher = createDecipheriv(ALGO, deriveKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
