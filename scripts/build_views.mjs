import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { build } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const ROOT = resolve(import.meta.dirname, '..')

export const VIEW_ENTRIES = ['board', 'task']

/**
 * Vite names the page after its source, index.html. Each view is written as
 * <entry>.html beside the others instead.
 */
function nameHtml(entry) {
  return {
    name: 'anachoic-name-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = bundle['index.html']
      if (page) {
        page.fileName = `${entry}.html`
      }
    },
  }
}

function buildEntry(entry, { outDir, watch }) {
  return build({
    configFile: false,
    mode: 'production',
    root: resolve(ROOT, 'view/entries', entry),
    publicDir: false,
    logLevel: 'warn',
    plugins: [react(), viteSingleFile(), nameHtml(entry)],
    build: {
      outDir,
      emptyOutDir: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      watch: watch ? {} : null,
    },
  })
}

/**
 * Builds each view entry into one self-contained HTML file in outDir.
 */
export async function buildViews({ outDir = resolve(ROOT, 'dist/views'), watch = false } = {}) {
  // Vite and the React plugin pick the development JSX runtime and React build
  // from NODE_ENV, which Vitest sets to test.
  process.env.NODE_ENV = 'production'
  return Promise.all(VIEW_ENTRIES.map((entry) => buildEntry(entry, { outDir, watch })))
}

if (import.meta.main) {
  await buildViews({ watch: process.argv.includes('--watch') })
}
