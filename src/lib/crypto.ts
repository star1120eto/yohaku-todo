// Google連携のトークンなど、機微な文字列を保存前に暗号化するための鍵。
// Node / Cloudflare Workers の両方で動作する Web Crypto (`crypto.subtle`) のみを使う。
// GCAL_TOKEN_SECRET は本番運用時に必ず設定する(未設定時は開発用の既定値にフォールバック)。
const ITERATIONS = 100_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

let cachedKey: Promise<CryptoKey> | null = null;

function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = process.env.GCAL_TOKEN_SECRET || "yohaku-dev-secret-not-for-production";
  cachedKey = crypto.subtle
    .importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"])
    .then((keyMaterial) =>
      crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new TextEncoder().encode("yohaku-gcal-salt"),
          iterations: ITERATIONS,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      )
    );
  return cachedKey;
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain)
  );
  return `${toHex(iv)}:${toHex(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  const [ivHex, dataHex] = stored.split(":");
  const key = await deriveKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromHex(ivHex) },
    key,
    fromHex(dataHex)
  );
  return new TextDecoder().decode(plain);
}
