import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages (https://<user>.github.io/MosaicArtProject/) で配信するためのパス
  base: '/MosaicArtProject/',
  plugins: [react()],
})
