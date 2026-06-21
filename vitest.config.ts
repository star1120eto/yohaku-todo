import { defineConfig } from "vitest/config";
import path from "path";

// 単体テストは古典学派(Classicist)の方針で構築している:
// - 可能な限り本物のオブジェクトを使い、モック/スタブは持ち込まない
// - 検証するのは戻り値(結果)や永続化された状態
// - テスト対象は「振る舞いの単位」(必ずしも 1 クラス・1 関数ではない)
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: false,
  },
});
