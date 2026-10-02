import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, beforeEach, expect, test } from 'vitest'

const SERVER = resolve(import.meta.dirname, '../../dist/server.js')
const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app'
const SENTINEL = 'anachoic-sentinel-value'

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'anachoic-integration', version: '1.2.3' },
  },
}
const INITIALIZED = { jsonrpc: '2.0', method: 'notifications/initialized' }
const LIST_RESOURCES = { jsonrpc: '2.0', id: 2, method: 'resources/list' }

let dataDir: string

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

/**
 * Starts the built server as desktop does: an empty environment apart from
 * the data directory (and a sentinel that must never reach the log), and / as
 * the working directory.
 */
function startServer() {
  const child = spawn(process.execPath, [SERVER], {
    cwd: '/',
    env: { ANACHOIC_DATA_DIR: dataDir, ANACHOIC_SENTINEL: SENTINEL },
    stdio: ['pipe', 'pipe', 'ignore'],
  })
  let stdout = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })
  const exited = once(child, 'exit') as Promise<[number | null, NodeJS.Signals | null]>
  return {
    child,
    exited,
    stdout: () => stdout,
    send(message: object) {
      child.stdin.write(`${JSON.stringify(message)}\n`)
    },
    async waitForResponse(id: number) {
      await expect.poll(() => stdout.includes(`"id":${id}`)).toBe(true)
    },
  }
}

async function logText() {
  const logs = join(dataDir, 'logs')
  const files = await readdir(logs)
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^server-\d{4}-\d{2}-\d{2}\.log$/)
  return readFile(join(logs, files[0]), 'utf8')
}

test('lists both views and reads each as an MCP App resource that prefers a border', async () => {
  const client = new Client({ name: 'anachoic-integration', version: '0.0.0' })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir },
      stderr: 'ignore',
    })
  )

  const packageJson = JSON.parse(
    await readFile(resolve(import.meta.dirname, '../../package.json'), 'utf8')
  ) as { version: string }
  expect(client.getServerVersion()).toMatchObject({
    name: 'anachoic',
    version: packageJson.version,
  })

  const { resources } = await client.listResources()
  const uris = resources.map(({ uri }) => uri).sort()
  expect(uris).toHaveLength(3)
  expect(uris[0]).toMatch(/^ui:\/\/anachoic\/board-[0-9a-f]{12}\.html$/)
  expect(uris[1]).toMatch(/^ui:\/\/anachoic\/history-[0-9a-f]{12}\.html$/)
  expect(uris[2]).toMatch(/^ui:\/\/anachoic\/task-[0-9a-f]{12}\.html$/)

  for (const { uri } of resources) {
    const { contents } = await client.readResource({ uri })
    expect(contents).toHaveLength(1)
    const [content] = contents
    expect(content.mimeType).toBe(MCP_APP_MIME_TYPE)
    expect(content._meta).toEqual({ ui: { prefersBorder: true } })
    expect('text' in content && content.text).toMatch(/^<!doctype html>/i)
  }

  await client.close()
})

test('writes only protocol messages to stdout and exits with 0 when stdin ends', async () => {
  const server = startServer()
  server.send(INITIALIZE)
  server.send(INITIALIZED)
  server.send(LIST_RESOURCES)
  await server.waitForResponse(2)
  server.child.stdin.end()

  expect(await server.exited).toEqual([0, null])
  const lines = server.stdout().trimEnd().split('\n')
  expect(lines).toHaveLength(2)
  for (const line of lines) {
    expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' })
  }

  const log = await logText()
  const events = log
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { event: string })
  expect(events.map(({ event }) => event)).toEqual(['start', 'initialized', 'exit'])
  expect(events[0]).toMatchObject({
    node: process.version,
    transport: 'stdio',
    dataDirectory: dataDir,
  })
  expect(events[1]).toMatchObject({ client: { name: 'anachoic-integration', version: '1.2.3' } })
  expect(log).not.toContain(SENTINEL)
  expect(log).not.toContain('ANACHOIC_SENTINEL')
  expect(log).not.toContain('ANACHOIC_DATA_DIR')
})

test('exits with 0 on SIGTERM', async () => {
  const server = startServer()
  server.send(INITIALIZE)
  await server.waitForResponse(1)
  server.child.kill('SIGTERM')

  expect(await server.exited).toEqual([0, null])
  expect(await logText()).toContain('"event":"exit","reason":"SIGTERM","code":0')
})

test('refuses to start without a data directory it can resolve', async () => {
  const child = spawn(process.execPath, [SERVER], {
    cwd: '/',
    env: { ANACHOIC_DATA_DIR: 'relative/path' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })
  let stdout = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })

  const [code] = await once(child, 'exit')
  expect(code).not.toBe(0)
  expect(stderr).toContain('ANACHOIC_DATA_DIR')
  expect(stdout).toBe('')
})
