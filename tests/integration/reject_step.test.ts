import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

const POLL_MS = 200

const WAIT_ENV = {
  ANACHOIC_WAIT_POLL_MS: String(POLL_MS),
  ANACHOIC_WAIT_PROGRESS_MS: '1000',
  ANACHOIC_WAIT_TIMEOUT_MS: '3000',
}

const NOTE = 'The PR targets the wrong branch'

let dataDir: string
let chat: Client
let api: Client
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

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  chat = await open('claude-ai')
  api = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-a',
    CLAUDE_PROJECT_DIR: '/w/api-server',
    ...WAIT_ENV,
  })
  await call(api, 'join_board')
  await call(chat, 'add_task', {
    title: 'Add retries',
    steps: [
      { title: 'Open the PR', owner: 'agent', output_format: 'pull_request' },
      { title: 'Review the PR', owner: 'user' },
    ],
  })
  await call(api, 'claim_step')
  await call(api, 'complete_step', {
    task: 'T-001',
    summary: 'Opened it against main',
    artifact_url: 'https://github.com/o/r/pull/7',
  })
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

test('rejecting the step before the user’s sends it back to the worker that did it, with the note', async () => {
  const waiting = call(api, 'wait_for_work')
  await sleep(POLL_MS * 2)

  expect(await call(chat, 'reject_step', { task: 'T-001', note: NOTE })).toEqual({
    text: 'Rejected step 1 of T-001. It is back in the queue at position 1 for api-server.',
    isError: false,
  })
  expect(
    query(dataDir, 'SELECT status, rejection, artifact_url FROM steps ORDER BY number')
  ).toEqual([
    { status: 'pending', rejection: NOTE, artifact_url: null },
    { status: 'pending', rejection: null, artifact_url: null },
  ])

  expect(await waiting).toEqual({
    text: `The user rejected step 1 of T-001, “Open the PR”: ${NOTE}. Call claim_step with task T-001 to redo it.`,
    isError: false,
  })

  const claimed = await call(api, 'claim_step', { task: 'T-001' })
  expect(claimed.text).toContain(
    `The user rejected the last attempt: ${NOTE}\nLast attempt: Opened it against main`
  )

  await call(api, 'complete_step', {
    task: 'T-001',
    summary: 'Retargeted it',
    artifact_url: 'https://github.com/o/r/pull/8',
  })
  expect(query(dataDir, 'SELECT status, rejection FROM steps ORDER BY number')).toEqual([
    { status: 'done', rejection: null },
    { status: 'waiting', rejection: null },
  ])
})

test('a worker cannot call reject_step, which is for the board view only', async () => {
  const tools = await api.listTools()
  const rejectTool = tools.tools.find((tool) => tool.name === 'reject_step')
  expect(rejectTool?._meta?.ui).toMatchObject({ visibility: ['app'] })
})
