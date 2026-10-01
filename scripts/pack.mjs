import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const EXTENSION = join(ROOT, 'mcpb')
const EXTENSION_SERVER = join(EXTENSION, 'server')
const MCPB = join(ROOT, 'node_modules', '.bin', 'mcpb')
const PACKAGE = join(ROOT, 'anachoic.mcpb')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status ?? result.signal}`)
  }
}

function versionOf(path) {
  return JSON.parse(readFileSync(path, 'utf8')).version
}

const packageVersion = versionOf(join(ROOT, 'package.json'))
const manifestVersion = versionOf(join(EXTENSION, 'manifest.json'))
if (packageVersion !== manifestVersion) {
  throw new Error(
    `mcpb/manifest.json is at version ${manifestVersion} but package.json is at ${packageVersion}.`
  )
}

/**
 * Builds, lays the server and its views out in mcpb/server/ as the
 * extension runs them, and packs mcpb/ into anachoic.mcpb.
 */
run('pnpm', ['build'])

rmSync(EXTENSION_SERVER, { recursive: true, force: true })
mkdirSync(join(EXTENSION_SERVER, 'views'), { recursive: true })
cpSync(join(DIST, 'server.js'), join(EXTENSION_SERVER, 'server.js'))
for (const file of readdirSync(join(DIST, 'views')).filter((name) => name.endsWith('.html'))) {
  cpSync(join(DIST, 'views', file), join(EXTENSION_SERVER, 'views', file))
}

rmSync(PACKAGE, { force: true })
run(MCPB, ['validate', join(EXTENSION, 'manifest.json')])
run(MCPB, ['pack', EXTENSION, PACKAGE])
