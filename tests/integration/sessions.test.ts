import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

let dataDir: string
const clients: Client[] = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function start(clientName: string, env: Record<string, string> = {}) {
  const client = await connect({ dataDir, clientName, env })
  clients.push(client)
  return client
}

async function joinBoard(client: Client, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name: 'join_board', arguments: args })
  return { text: textOf(result), isError: result.isError ?? false }
}

async function joinedText(client: Client, args: Record<string, unknown> = {}) {
  const { text } = await joinBoard(client, args)
  return text
}

interface SessionRow {
  id: string
  kind: string
  name: string
  project_dir: string | null
}

function sessions() {
  return query<SessionRow>(dataDir, 'SELECT id, kind, name, project_dir FROM sessions ORDER BY id')
}

async function logLines() {
  const logs = join(dataDir, 'logs')
  const files = await readdir(logs)
  const texts = await Promise.all(files.map((file) => readFile(join(logs, file), 'utf8')))
  return texts
    .join('')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

test('a Claude Code worker is named by its session id and its project directory', async () => {
  const worker = await start('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'e261-worker',
    CLAUDE_PROJECT_DIR: '/tmp/api-server',
  })

  expect(await joinBoard(worker)).toEqual({
    text: 'Joined the board as "api-server", a worker session, with session id e261-worker.',
    isError: false,
  })
  expect(sessions()).toEqual([
    { id: 'e261-worker', kind: 'worker', name: 'api-server', project_dir: '/tmp/api-server' },
  ])

  expect(await joinedText(worker, { name: 'api' })).toBe(
    'Joined the board as "api", a worker session, with session id e261-worker.'
  )
  expect(sessions().map(({ name }) => name)).toEqual(['api'])
})

test('Claude Code without CLAUDE_CODE_SESSION_ID is given a minted id', async () => {
  const worker = await start('claude-code', { CLAUDE_PROJECT_DIR: '/tmp/api-server' })

  const { text } = await joinBoard(worker)
  expect(text).toMatch(/^Joined the board as "Session", a worker session, with session id \S+\./)
  expect(text).toContain('Pass session "')
})

test('desktop chat is the dedicated session, named This chat', async () => {
  const chat = await start('claude-ai')

  expect(await joinedText(chat)).toBe(
    'Joined the board as "This chat", the dedicated session, with session id dedicated.'
  )
  expect(sessions()).toEqual([
    { id: 'dedicated', kind: 'dedicated', name: 'This chat', project_dir: null },
  ])
})

test('an unknown client gets a minted id, which another process can name as its session', async () => {
  const first = await start('some-other-client')
  const { text } = await joinBoard(first, { name: 'scripts' })
  const id = /session id (\S+)\. Pass session "\1"/.exec(text)?.[1]
  expect(id).toBeDefined()

  expect(await joinedText(first)).toContain(`session id ${id}.`)

  const second = await start('some-other-client')
  expect(await joinedText(second, { session: id })).toBe(
    `Joined the board as "scripts", a worker session, with session id ${id}. Pass session "${id}" on every later call to this server's tools.`
  )
  expect(sessions()).toEqual([{ id, kind: 'worker', name: 'scripts', project_dir: null }])
})

test('a session id the board has never seen is refused', async () => {
  const client = await start('some-other-client')

  const { text, isError } = await joinBoard(client, { session: 'made-up' })
  expect(isError).toBe(true)
  expect(text).toBe(
    'Session made-up does not exist. Call join_board without session to get a session id.'
  )
  expect(await joinBoard(client, { session: 'dedicated' })).toMatchObject({ isError: true })
  expect(sessions()).toEqual([])
})

test('two workers and the dedicated session on one data directory each appear once', async () => {
  const [a, b, chat] = await Promise.all([
    start('claude-code', { CLAUDE_CODE_SESSION_ID: 'worker-a', CLAUDE_PROJECT_DIR: '/w/api' }),
    start('claude-code', { CLAUDE_CODE_SESSION_ID: 'worker-b', CLAUDE_PROJECT_DIR: '/w/web' }),
    start('claude-ai'),
  ])

  for (let round = 0; round < 3; round++) {
    await Promise.all([a, b, chat].map((client) => joinBoard(client)))
    await Promise.all(
      [a, b, chat].map((client) => client.callTool({ name: 'show_board', arguments: {} }))
    )
  }

  expect(sessions()).toEqual([
    { id: 'dedicated', kind: 'dedicated', name: 'This chat', project_dir: null },
    { id: 'worker-a', kind: 'worker', name: 'api', project_dir: '/w/api' },
    { id: 'worker-b', kind: 'worker', name: 'web', project_dir: '/w/web' },
  ])
})

test('the log records the client and the host variable names, and later lines the session id', async () => {
  const worker = await start('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-a',
    CLAUDE_PROJECT_DIR: '/w/api',
    CLAUDE_CODE_ACCOUNT_UUID: 'secret-account-value',
  })
  await joinBoard(worker)

  const lines = await logLines()
  const initialized = lines.find(({ event }) => event === 'initialized')
  expect(initialized).toMatchObject({
    client: { name: 'claude-code', version: '0.0.0' },
    kind: 'worker',
    environment: ['CLAUDE_CODE_ACCOUNT_UUID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_PROJECT_DIR'],
  })
  expect(initialized).not.toHaveProperty('sessionId')
  expect(lines.find(({ event }) => event === 'session')).toMatchObject({
    sessionId: 'worker-a',
    id: 'worker-a',
    kind: 'worker',
    source: 'client',
  })
  expect(JSON.stringify(lines)).not.toContain('secret-account-value')
})
