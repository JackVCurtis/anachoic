import { resolve } from 'node:path'
import { build, context } from 'esbuild'

const ROOT = resolve(import.meta.dirname, '..')

const OPTIONS = {
  entryPoints: [resolve(ROOT, 'server/main.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: resolve(ROOT, 'dist/server.js'),
  logLevel: 'warning',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
}

/**
 * Bundles the server into one ESM file. esbuild's CLI shim fails under
 * pnpm 11, so the build goes through its JavaScript API.
 */
export async function buildServer({ watch = false } = {}) {
  if (!watch) {
    return build(OPTIONS)
  }
  const watching = await context(OPTIONS)
  await watching.watch()
  return watching
}

if (import.meta.main) {
  await buildServer({ watch: process.argv.includes('--watch') })
}
