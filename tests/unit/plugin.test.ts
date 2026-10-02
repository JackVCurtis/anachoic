import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { buildPlugin, MARKETPLACE_NAME, PLUGIN_NAME } from '../../scripts/plugin.mjs'

const ROOT = resolve(import.meta.dirname, '../..')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'mcpb', 'manifest.json'), 'utf8'))

let directory: string
let dist: string
let out: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-plugin-'))
  dist = join(directory, 'dist')
  out = join(directory, 'plugin')
  mkdirSync(join(dist, 'views'), { recursive: true })
  writeFileSync(join(dist, 'server.js'), '// server')
  writeFileSync(join(dist, 'views', 'board-0123456789ab.html'), '<html></html>')
  writeFileSync(join(dist, 'views', 'board.js.map'), '{}')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function json(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** A plugin path with the plugin root put in, as Claude Code resolves it. */
function inPlugin(text: string, root: string) {
  return text.replaceAll('${CLAUDE_PLUGIN_ROOT}', root)
}

test('the marketplace names anachoic and lists the anachoic-worker plugin at a folder that exists', () => {
  buildPlugin({ dist, out, manifest: MANIFEST, version: '1.2.3' })
  const marketplace = json(join(out, '.claude-plugin', 'marketplace.json'))

  expect(marketplace).toMatchObject({
    name: MARKETPLACE_NAME,
    owner: { name: 'Jack Curtis' },
    plugins: [{ name: PLUGIN_NAME, source: './anachoic-worker', version: '1.2.3' }],
  })
  expect(MARKETPLACE_NAME).toBe('anachoic')
  const [entry] = marketplace.plugins
  expect(existsSync(join(out, entry.source, '.claude-plugin', 'plugin.json'))).toBe(true)
})

test('the plugin declares the MCP server and the SessionEnd hook, both on the server it bundles', () => {
  const { plugin } = buildPlugin({ dist, out, manifest: MANIFEST, version: '1.2.3' })
  const manifest = json(join(plugin, '.claude-plugin', 'plugin.json'))

  expect(manifest).toMatchObject({ name: 'anachoic-worker', version: '1.2.3' })
  expect(manifest.mcpServers).toEqual({
    anachoic: {
      command: 'node',
      args: ['${CLAUDE_PLUGIN_ROOT}/server/server.js'],
      env: { ANACHOIC_DATA_DIR: '${HOME}/Library/Application Support/Anachoic MCP' },
    },
  })
  for (const arg of manifest.mcpServers.anachoic.args) {
    expect(existsSync(inPlugin(arg, plugin))).toBe(true)
  }

  const [handler] = manifest.hooks.SessionEnd[0].hooks
  expect(handler).toEqual({
    type: 'command',
    command:
      'ANACHOIC_DATA_DIR="$HOME/Library/Application Support/Anachoic MCP" node "${CLAUDE_PLUGIN_ROOT}/server/server.js" --session-ended',
    timeout: 5,
  })
  const serverInHook = /node "([^"]+)" --session-ended$/.exec(handler.command)![1]
  expect(existsSync(inPlugin(serverInHook, plugin))).toBe(true)
  expect(existsSync(join(plugin, 'server', 'views', 'board-0123456789ab.html'))).toBe(true)
  expect(existsSync(join(plugin, 'server', 'views', 'board.js.map'))).toBe(false)
})

test('a second build replaces the first', () => {
  buildPlugin({ dist, out, manifest: MANIFEST, version: '1.2.3' })
  writeFileSync(join(out, 'stale.txt'), 'old')
  buildPlugin({ dist, out, manifest: MANIFEST, version: '1.2.4' })
  expect(existsSync(join(out, 'stale.txt'))).toBe(false)
  expect(json(join(out, '.claude-plugin', 'marketplace.json')).plugins[0].version).toBe('1.2.4')
})
