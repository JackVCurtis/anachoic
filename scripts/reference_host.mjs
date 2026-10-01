import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unwatchFile,
  watchFile,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  EXT_APPS_COMMIT,
  EXT_APPS_REPOSITORY,
  EXT_APPS_VERSION,
  REFERENCE_HOST_PORT,
} from './reference_host_version.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const CACHE = join(ROOT, '.cache')
const CLONE = join(CACHE, 'ext-apps')
const HOST = join(CACHE, 'basic-host')
const BUILT_STAMP = join(HOST, '.anachoic-built.json')
const DATA_DIR = join(CACHE, 'dev-data')
const SERVER = join(ROOT, 'dist', 'server.js')
const PORT = Number(process.env.PORT ?? 3001)
const MCP_URL = `http://127.0.0.1:${PORT}/mcp`
const STAMP = JSON.stringify({ commit: EXT_APPS_COMMIT, version: EXT_APPS_VERSION })

function say(message) {
  process.stderr.write(`[host] ${message}\n`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status ?? result.signal}`)
  }
}

function cloneAtCommit() {
  const head = existsSync(CLONE)
    ? spawnSync('git', ['-C', CLONE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
    : undefined
  if (head === EXT_APPS_COMMIT) {
    return
  }
  if (head === undefined) {
    say(`Cloning ext-apps into ${CLONE}`)
    mkdirSync(CACHE, { recursive: true })
    run('git', ['clone', '--filter=blob:none', '--no-checkout', EXT_APPS_REPOSITORY, CLONE])
  } else {
    run('git', ['-C', CLONE, 'fetch', 'origin', EXT_APPS_COMMIT])
  }
  run('git', ['-C', CLONE, 'checkout', '--quiet', '--detach', EXT_APPS_COMMIT])
}

/**
 * basic-host sits inside the ext-apps workspace, whose own build needs bun.
 * It is copied out and installed on its own, with the published package
 * pinned in place of the workspace's, and built with Vite once per page.
 */
function buildHost() {
  if (existsSync(BUILT_STAMP) && readFileSync(BUILT_STAMP, 'utf8') === STAMP) {
    return
  }
  cloneAtCommit()
  say(`Building the reference host against @modelcontextprotocol/ext-apps ${EXT_APPS_VERSION}`)
  rmSync(HOST, { recursive: true, force: true })
  cpSync(join(CLONE, 'examples', 'basic-host'), HOST, { recursive: true })

  const packagePath = join(HOST, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  packageJson.dependencies['@modelcontextprotocol/ext-apps'] = EXT_APPS_VERSION
  packageJson.devDependencies.tsx = '4.23.15'
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: HOST })
  for (const input of ['index.html', 'sandbox.html']) {
    run(join(HOST, 'node_modules', '.bin', 'vite'), ['build', '--logLevel', 'warn'], {
      cwd: HOST,
      env: { ...process.env, INPUT: input, NODE_ENV: 'production' },
    })
  }
  writeFileSync(BUILT_STAMP, STAMP)
}

const children = new Set()

function start(command, args, options) {
  const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options })
  children.add(child)
  child.on('exit', () => children.delete(child))
  return child
}

function startServer() {
  return start(process.execPath, [SERVER, '--http'], {
    cwd: ROOT,
    env: { ...process.env, ANACHOIC_DATA_DIR: DATA_DIR, PORT: String(PORT) },
  })
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }
  return new Promise((done) => {
    child.once('exit', () => done())
    child.kill('SIGTERM')
  })
}

/**
 * Restarts the server whenever the build replaces dist/server.js. Polling
 * survives `pnpm build` deleting dist/, which an fs.watch handle would not.
 */
function watchServer() {
  let server = startServer()
  let restarting = Promise.resolve()
  watchFile(SERVER, { interval: 300 }, (current, previous) => {
    if (current.mtimeMs === 0 || current.mtimeMs === previous.mtimeMs) {
      return
    }
    restarting = restarting.then(async () => {
      say('dist/server.js changed, restarting the server')
      await stopChild(server)
      server = startServer()
    })
  })
}

if (!existsSync(SERVER)) {
  say('dist/server.js is missing. Run `pnpm build` or `pnpm dev` first.')
  process.exit(1)
}

buildHost()
mkdirSync(DATA_DIR, { recursive: true })
watchServer()
const host = start(join(HOST, 'node_modules', '.bin', 'tsx'), ['serve.ts'], {
  cwd: HOST,
  env: {
    ...process.env,
    HOST_PORT: String(REFERENCE_HOST_PORT),
    SERVERS: JSON.stringify([MCP_URL]),
  },
})

say(`Reference host: http://localhost:${REFERENCE_HOST_PORT}, connected to ${MCP_URL}`)
say(
  'The reference host allows more than Claude desktop does (data: fonts, a looser CSP), ' +
    'so check views in desktop chat before calling them done.'
)

async function stopAll(code) {
  unwatchFile(SERVER)
  await Promise.all([...children].map((child) => stopChild(child)))
  process.exit(code)
}

host.on('exit', (code) => void stopAll(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => void stopAll(0))
}
