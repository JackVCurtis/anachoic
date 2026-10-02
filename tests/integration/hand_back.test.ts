import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

const POLL_MS = 200
const TIMEOUT_MS = 3000
/** What a result may take beyond a poll interval to cross two processes. */
const SLACK_MS = 300

const WAIT_ENV = {
  ANACHOIC_WAIT_POLL_MS: String(POLL_MS),
  ANACHOIC_WAIT_PROGRESS_MS: '1000',
  ANACHOIC_WAIT_TIMEOUT_MS: String(TIMEOUT_MS),
}

const HAND_BACK =
  'The person finished step 2 of T-001, “Review the PR”: https://github.com/o/r/pull/7 Note: Looks good. Call claim_step with task T-001 to continue it.'

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

function waitForWork(client: Client) {
  return client.callTool({ name: 'wait_for_work', arguments: {} }).then((result) => ({
    text: textOf(result),
    isError: result.isError ?? false,
    at: Date.now(),
  }))
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  chat = await open('claude-ai')
  api = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-a',
    CLAUDE_PROJECT_DIR: '/w/api-server',
    ...WAIT_ENV,
  })
  web = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-b',
    CLAUDE_PROJECT_DIR: '/w/web-client',
    ...WAIT_ENV,
  })
  await call(api, 'join_board')
  await call(web, 'join_board')
  await call(chat, 'add_task', {
    title: 'Add retries',
    steps: [
      { title: 'Open the PR', owner: 'agent' },
      { title: 'Review the PR', owner: 'you', output_format: 'pull_request' },
      { title: 'Merge it', owner: 'agent' },
    ],
  })
  await call(api, 'claim_step')
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

function markDone() {
  return chat.callTool({
    name: 'complete_my_step',
    arguments: { task: 'T-001', note: 'Looks good', artifactUrl: 'https://github.com/o/r/pull/7' },
  })
}

test('a worker that hands a step to you waits, and gets the task back within one poll of your step being done', async () => {
  expect(await call(api, 'complete_step', { task: 'T-001', summary: 'Opened it' })).toEqual({
    text: "Completed T-001 step 1. Step 2 of T-001 is the person's. Call wait_for_work to be told when this task needs an agent again.",
    isError: false,
  })
  expect(query(dataDir, 'SELECT resume_with FROM tasks')).toEqual([{ resume_with: 'worker-a' }])

  const waiting = waitForWork(api)
  await sleep(POLL_MS * 2)
  const done = await markDone()
  expect(done.isError).toBeFalsy()
  const doneAt = Date.now()

  const result = await waiting
  expect(result).toMatchObject({ text: HAND_BACK, isError: false })
  expect(result.at - doneAt).toBeLessThan(POLL_MS + SLACK_MS)

  const claimed = await call(api, 'claim_step', { task: 'T-001' })
  expect(claimed.text).toMatch(/^Claimed T-001 step 3 of 3/)
  expect(query(dataDir, 'SELECT resume_with FROM tasks')).toEqual([{ resume_with: null }])
})

test('with two workers waiting, the hand-back goes to the worker in resume_with; once it has ended, the other is offered the task', async () => {
  await call(api, 'complete_step', { task: 'T-001', summary: 'Opened it' })
  const fromApi = waitForWork(api)
  const fromWeb = waitForWork(web)
  await sleep(POLL_MS * 2)

  await markDone()
  expect(await fromApi).toMatchObject({ text: HAND_BACK })
  const webWaited = await Promise.race([fromWeb, sleep(POLL_MS * 4).then(() => 'still waiting')])
  expect(webWaited).toBe('still waiting')

  await api.close()
  const backdated = new Date(Date.now() - 3 * 60_000).toISOString()
  const database = new DatabaseSync(join(dataDir, 'board.sqlite'))
  try {
    database.exec('PRAGMA busy_timeout = 5000')
    database.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = 'worker-a'").run(backdated)
  } finally {
    database.close()
  }
  // Any write releases the dead session, as the heartbeat would within 30 s.
  await call(chat, 'join_board')

  expect(await fromWeb).toMatchObject({
    text: 'T-001 is in the queue. Call claim_step with task T-001.',
    isError: false,
  })
  expect(query(dataDir, 'SELECT resume_with FROM tasks')).toEqual([{ resume_with: null }])
})
