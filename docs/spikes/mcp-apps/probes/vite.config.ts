import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  build: { rollupOptions: { input: 'view.html' }, outDir: 'dist', emptyOutDir: true, assetsInlineLimit: Number.MAX_SAFE_INTEGER },
})
