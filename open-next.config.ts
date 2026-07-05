import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ISR/画像最適化を使わない構成のため、追加の incremental cache 設定は不要。
export default defineCloudflareConfig();
