import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// `next dev` / `next start` でも Cloudflare のバインディング(D1 など)を使えるようにする。
// YOHAKU_DATA_DIR を指定すると、その場所にローカル D1 の状態を分離できる(E2E テスト用)。
initOpenNextCloudflareForDev({
  persist: process.env.YOHAKU_DATA_DIR
    ? { path: process.env.YOHAKU_DATA_DIR }
    : true,
});

export default nextConfig;
