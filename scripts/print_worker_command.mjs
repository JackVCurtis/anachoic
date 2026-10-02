import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const MINIMUM_NODE_MAJOR = 24

/**
 * Where Claude desktop on macOS unpacks an installed extension, relative to
 * the home directory. Each extension has a folder named
 * `local.mcpb.<author slug>.<name>` in it.
 */
const EXTENSIONS_DIR = join('Library', 'Application Support', 'Claude', 'Claude Extensions')

/**
 * The data directory the development loop uses, shared with the reference
 * host.
 */
export const DEV_DATA_DIR = join(ROOT, '.cache', 'dev-data')
export const DEV_SERVER = join(ROOT, 'dist', 'server.js')

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * The folder desktop installs the extension described by `manifest` into.
 */
export function extensionFolder(manifest, home) {
  return join(home, EXTENSIONS_DIR, `local.mcpb.${slug(manifest.author.name)}.${manifest.name}`)
}

/**
 * The data directory an installed manifest gives the server, with `${HOME}`
 * filled in as desktop fills it. Returns undefined when it depends on
 * anything else, such as a user_config value only desktop knows.
 */
export function dataDirOf(manifest, home) {
  const value = manifest.server?.mcp_config?.env?.ANACHOIC_DATA_DIR
  if (typeof value !== 'string') {
    return undefined
  }
  const filled = value.replaceAll('${HOME}', home)
  return filled.includes('${') ? undefined : filled
}

/**
 * One path as a double-quoted shell word. A path under `home` is written from
 * `$HOME`, which the shell expands inside double quotes; every other
 * character the shell treats specially inside double quotes is escaped.
 */
export function quotePath(path, home) {
  const escape = (text) => text.replace(/[\\"$`]/g, '\\$&')
  if (home && path.startsWith(`${home}/`)) {
    return `"$HOME/${escape(path.slice(home.length + 1))}"`
  }
  return `"${escape(path)}"`
}

/**
 * The `claude mcp add` command that adds the server at `serverPath` with
 * `dataDir` as its data directory.
 */
export function workerCommand({ name, scope, serverPath, dataDir, home }) {
  return [
    'claude mcp add',
    `--scope ${scope}`,
    name,
    `-e ANACHOIC_DATA_DIR=${quotePath(dataDir, home)}`,
    '--',
    'node',
    quotePath(serverPath, home),
  ].join(' ')
}

/**
 * The `hooks.SessionEnd` entry for ~/.claude/settings.json that removes the
 * worker from the board when its Claude Code session ends, for an install
 * without the anachoic-worker plugin. It is printed, never written.
 */
export function hookSettings({ serverPath, dataDir, home }) {
  return {
    hooks: {
      SessionEnd: [
        {
          hooks: [
            {
              type: 'command',
              command: `ANACHOIC_DATA_DIR=${quotePath(dataDir, home)} node ${quotePath(serverPath, home)} --session-ended`,
              timeout: 5,
            },
          ],
        },
      ],
    },
  }
}

/**
 * What to print for a server and data directory: the `claude mcp add`
 * command, or with --hook the settings entry for the SessionEnd hook.
 */
function output({ hook, name, scope, serverPath, dataDir, home }) {
  return hook
    ? JSON.stringify(hookSettings({ serverPath, dataDir, home }), null, 2)
    : workerCommand({ name, scope, serverPath, dataDir, home })
}

function nodeOnPath() {
  const result = spawnSync('node', ['-v'], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : undefined
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Works out the command for `argv` and returns what to print. Everything it
 * reads from the machine comes through the arguments, so tests can stand in
 * for an installed or missing extension.
 *
 * @param {{
 *   argv?: string[],
 *   home?: string,
 *   exists?: (path: string) => boolean,
 *   readManifest?: (path: string) => any,
 *   nodeVersion?: () => string | undefined,
 *   manifest?: any,
 * }} [options]
 */
export function printWorkerCommand({
  argv = [],
  home = homedir(),
  exists = existsSync,
  readManifest = readJson,
  nodeVersion = nodeOnPath,
  manifest = readJson(join(ROOT, 'mcpb', 'manifest.json')),
} = {}) {
  const dev = argv.includes('--dev')
  const hook = argv.includes('--hook')
  const scope = argv.includes('--project') ? 'project' : 'user'
  const stderr = []

  const version = nodeVersion()
  const major = Number(/^v(\d+)\./.exec(version ?? '')?.[1])
  if (!(major >= MINIMUM_NODE_MAJOR)) {
    stderr.push(
      `Warning: node on the PATH is ${version ?? 'missing'}, and the worker's server needs node ${MINIMUM_NODE_MAJOR} or newer for node:sqlite.`
    )
  }

  if (dev) {
    if (!exists(DEV_SERVER)) {
      return {
        code: 1,
        stdout: '',
        stderr: [...stderr, `${DEV_SERVER} is missing. Run pnpm build first.`],
      }
    }
    const command = output({
      hook,
      name: `${manifest.name}-dev`,
      scope,
      serverPath: DEV_SERVER,
      dataDir: DEV_DATA_DIR,
      home,
    })
    return { code: 0, stdout: command, stderr }
  }

  const folder = extensionFolder(manifest, home)
  const serverPath = join(folder, 'server', 'server.js')
  const installedManifest = join(folder, 'manifest.json')
  if (!exists(serverPath) || !exists(installedManifest)) {
    return {
      code: 1,
      stdout: '',
      stderr: [
        ...stderr,
        `The Anachoic extension is not installed at ${folder}. Install anachoic.mcpb in Claude desktop first.`,
      ],
    }
  }
  const dataDir = dataDirOf(readManifest(installedManifest), home)
  if (!dataDir) {
    return {
      code: 1,
      stdout: '',
      stderr: [
        ...stderr,
        `${installedManifest} does not set ANACHOIC_DATA_DIR to a path this script can fill in.`,
      ],
    }
  }
  const command = output({ hook, name: manifest.name, scope, serverPath, dataDir, home })
  return { code: 0, stdout: command, stderr }
}

if (import.meta.main) {
  const { code, stdout, stderr } = printWorkerCommand({ argv: process.argv.slice(2) })
  for (const line of stderr) {
    process.stderr.write(`${line}\n`)
  }
  if (stdout) {
    process.stdout.write(`${stdout}\n`)
  }
  process.exitCode = code
}
