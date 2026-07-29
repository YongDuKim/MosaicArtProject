import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 対象はブラウザ API に依存しない純粋なロジックのみ。
    // canvas / ImageBitmap を使う処理はブラウザでの動作確認に委ねる。
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
