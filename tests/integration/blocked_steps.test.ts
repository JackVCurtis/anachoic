import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { BoardProps } from '../../shared/props.js'
import { connect, query, textOf } from './support/server.js'

let dataDir: string
let chat: Client
let api: Client
let web: Client
const clients: Client[] = []

async function open(clientName: string, env: Record<string, string> = {}) {
  const client = await connect({ dataDir, clientName, env })
  clients.push(client)
  return client
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  return { text: textOf(result), isError: result.isError ?? false }
}

async function board() {
  const result = await chat.callTool({ name: 'get_board', arguments: {} })
  return result.structuredContent as BoardProps
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  chat = await open('claude-ai')
  api = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-a',
    CLAUDE_PROJECT_DIR: '/w/api-server',
  })
  web = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-b',
    CLAUDE_PROJECT_DIR: '/w/web-client',
  })
  await call(chat, 'add_task', {
    title: 'Ship it',
    steps: [{ title: 'Deploy', owner: 'agent' }],
  })
  await call(api, 'claim_step')
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

test('a blocked step is in Your turn with its reason, refuses complete_step until unblocked, then runs and leaves Your turn', async () => {
  expect(await call(api, 'block_step', { task: 'T-001', reason: 'needs AWS credentials' })).toEqual(
    {
      text: 'Blocked. The user will unblock this in this session. End this turn now and wait for the user here; when they have resolved it, call unblock_step with task T-001.',
      isError: false,
    }
  )

  const blocked = await board()
  expect(blocked.yourTurn).toHaveLength(1)
  expect(blocked.yourTurn[0]).toMatchObject({
    task: { displayId: 'T-001' },
    session: { id: 'worker-a', name: 'api-server' },
    blocked: { reason: 'needs AWS credentials' },
  })
  expect(blocked.working).toEqual([])
  const summary = await call(chat, 'show_board')
  expect(summary.text).toContain(
    'Waiting on user (1): T-001 step 1 "Deploy" is blocked (api-server): needs AWS credentials'
  )

  expect(await call(api, 'complete_step', { task: 'T-001', summary: 'Done' })).toEqual({
    text: 'Step 1 of T-001 is blocked. Call unblock_step first.',
    isError: true,
  })

  expect(await call(api, 'unblock_step', { task: 'T-001', note: 'Credentials added' })).toEqual({
    text: 'Unblocked. Carry on with step 1 of T-001.',
    isError: false,
  })
  const unblocked = await board()
  expect(unblocked.yourTurn).toEqual([])
  expect(unblocked.working.map(({ task }) => task.displayId)).toEqual(['T-001'])
  expect(query(dataDir, "SELECT kind, detail FROM events WHERE kind LIKE '%blocked'")).toEqual([
    { kind: 'blocked', detail: 'needs AWS credentials' },
    { kind: 'unblocked', detail: 'Credentials added' },
  ])
  const completed = await call(api, 'complete_step', { task: 'T-001', summary: 'Done' })
  expect(completed.isError).toBe(false)
})

test('another session’s block_step or unblock_step on the step is refused with not_yours', async () => {
  const notYours = { text: 'Step 1 of T-001 is claimed by api-server', isError: true }
  expect(await call(web, 'block_step', { task: 'T-001', reason: 'mine' })).toEqual(notYours)
  await call(api, 'block_step', { task: 'T-001', reason: 'needs AWS credentials' })
  expect(await call(web, 'unblock_step', { task: 'T-001' })).toEqual(notYours)
  expect(query(dataDir, 'SELECT status, blocked_reason FROM steps')).toEqual([
    { status: 'waiting', blocked_reason: 'needs AWS credentials' },
  ])
})

test('a reason over 250 characters is refused and the step keeps running', async () => {
  const refused = await call(api, 'block_step', { task: 'T-001', reason: 'x'.repeat(251) })
  expect(refused.isError).toBe(true)
  expect(query(dataDir, 'SELECT status, blocked_reason FROM steps')).toEqual([
    { status: 'running', blocked_reason: null },
  ])
})
