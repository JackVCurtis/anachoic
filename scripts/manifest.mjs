import { readFileSync, writeFileSync } from 'node:fs'
import { manifestPrompts } from '../shared/prompts.mjs'

/**
 * The manifest with its prompts array written from shared/prompts.mjs, so
 * it declares exactly the prompts and text the server serves.
 */
export function withPrompts(manifest) {
  return { ...manifest, prompts: manifestPrompts() }
}

/**
 * Rewrites the manifest file's version, when one is given, and its prompts
 * from shared/prompts.mjs, leaving the file untouched when they already
 * match. Returns the manifest.
 */
export function writeManifest(path, version) {
  const before = readFileSync(path, 'utf8')
  const parsed = JSON.parse(before)
  const manifest = withPrompts(version === undefined ? parsed : { ...parsed, version })
  const after = `${JSON.stringify(manifest, null, 2)}\n`
  if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(manifest)) {
    writeFileSync(path, after)
  }
  return manifest
}
