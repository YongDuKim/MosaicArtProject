import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages (https://<user>.github.io/MosaicArtProject/) で配信するためのパス
  base: "/MosaicArtProject/",
  plugins: [react()],
  // Worker 内の動的 import (HEIC デコーダ heic-to) を別チャンクへ分割し、
  // HEIC を含まないタイル読み込みで重いデコーダを読み込まないようにする。
  worker: { format: "es" },
});
