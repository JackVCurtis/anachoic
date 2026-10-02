import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

const POLL_MS = 200
const PROGRESS_MS = 150
const TIMEOUT_MS = 700
/** What a result may take beyond a poll interval to cross two processes. */
const SLACK_MS = 300

let dataDir: string
let view: Client
let api: Client
const clients: Client[] = []

async function open(clientName: string, env: Record<string, string> = {}) {
  const client = await connect({ dataDir, clientName, env })
  clients.push(client)
  return client
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  view = await open('claude-ai')
  api = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-a',
    CLAUDE_PROJECT_DIR: '/w/api-server',
    ANACHOIC_WAIT_POLL_MS: String(POLL_MS),
    ANACHOIC_WAIT_PROGRESS_MS: String(PROGRESS_MS),
    ANACHOIC_WAIT_TIMEOUT_MS: String(TIMEOUT_MS),
  })
  await call(api, 'add_task', {
    title: 'Cache',
    steps: [{ title: 'Pick a cache', owner: 'agent' }],
  })
  await call(api, 'claim_step')
  await call(api, 'ask_you', { task: 'T-001', question: 'Redis or in-process?' })
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  return { text: textOf(result), isError: result.isError ?? false }
}

/**
 * Starts wait_for_answer, and resolves with its result and the moment it
 * arrived.
 */
function waitForAnswer(options: { signal?: AbortSignal } = {}) {
  return api
    .callTool({ name: 'wait_for_answer', arguments: { task: 'T-001' } }, options)
    .then((result) => ({
      text: textOf(result),
      isError: result.isError ?? false,
      at: Date.now(),
    }))
}

/**
 * The wait_ lines of the worker process's log, in order.
 */
function waitLog() {
  const logs = join(dataDir, 'logs')
  return readdirSync(logs)
    .sort()
    .flatMap((file) => readFileSync(join(logs, file), 'utf8').split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event: string; reason?: string })
    .filter((entry) => entry.event.startsWith('wait_'))
}

test('your answer from another process ends the wait within one poll, and only once', async () => {
  const waiting = waitForAnswer()
  await sleep(POLL_MS * 2)

  await call(view, 'answer_question', { task: 'T-001', answer: 'Redis' })
  const answeredAt = Date.now()
  const result = await waiting

  expect(result).toMatchObject({
    text: 'The user answered your question on T-001:\nRedis',
    isError: false,
  })
  expect(result.at - answeredAt).toBeLessThan(POLL_MS + SLACK_MS)
  expect(query(dataDir, 'SELECT status, answer FROM steps')).toEqual([
    { status: 'running', answer: null },
  ])

  expect(await waitForAnswer()).toMatchObject({
    text: 'Step 1 of T-001 has no question waiting for an answer. Call ask_you first.',
    isError: true,
  })
})

test('progress arrives at its interval with the request’s token, and the call returns at its timeout', async () => {
  const progress: number[] = []
  const started = Date.now()

  const result = await api.callTool(
    { name: 'wait_for_answer', arguments: { task: 'T-001' } },
    { onprogress: ({ progress: value }) => progress.push(value) }
  )

  expect(textOf(result)).toBe('No answer yet. Call wait_for_answer again to keep waiting.')
  expect(result.isError).toBeFalsy()
  expect(Date.now() - started).toBeGreaterThanOrEqual(TIMEOUT_MS)
  expect(progress.length).toBeGreaterThanOrEqual(Math.floor(TIMEOUT_MS / PROGRESS_MS) - 1)
  expect(progress).toEqual(progress.map((_value, index) => index + 1))
  expect(query(dataDir, 'SELECT status, question FROM steps')).toEqual([
    { status: 'waiting', question: 'Redis or in-process?' },
  ])
})

test.each([
  ['move_to_backlog', 'T-001 was parked. Stop work on it.'],
  ['archive_task', 'T-001 was archived. Stop work on it.'],
])('%s during the wait ends it within one poll', async (action, sentence) => {
  const waiting = waitForAnswer()
  await sleep(POLL_MS)

  await call(view, action, { task: 'T-001' })
  const actedAt = Date.now()
  const result = await waiting

  expect(result).toMatchObject({ text: sentence, isError: false })
  expect(result.at - actedAt).toBeLessThan(POLL_MS + SLACK_MS)
})

test('cancelling the call stops the polling, keeps the question, and a later call gets the answer', async () => {
  const controller = new AbortController()
  const cancelled = waitForAnswer({ signal: controller.signal }).catch((error: Error) => error)
  await sleep(POLL_MS * 2)

  controller.abort()
  expect(await cancelled).toBeInstanceOf(Error)
  await sleep(POLL_MS * 3)
  const settled = waitLog()
  await sleep(POLL_MS * 3)

  expect(waitLog()).toEqual(settled)
  expect(settled.at(-1)).toMatchObject({ event: 'wait_end', reason: 'cancelled' })
  expect(query(dataDir, 'SELECT status, question FROM steps')).toEqual([
    { status: 'waiting', question: 'Redis or in-process?' },
  ])

  const again = waitForAnswer()
  await sleep(POLL_MS)
  await call(view, 'answer_question', { task: 'T-001', answer: 'In-process' })
  expect(await again).toMatchObject({
    text: 'The user answered your question on T-001:\nIn-process',
  })
})

test('wait_for_answer on a step the worker does not hold is refused', async () => {
  const other = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-b',
    CLAUDE_PROJECT_DIR: '/w/web',
  })

  expect(await call(other, 'wait_for_answer', { task: 'T-001' })).toEqual({
    text: 'Step 1 of T-001 is claimed by api-server',
    isError: true,
  })
})

test('wait_for_answer from the dedicated session is refused', async () => {
  expect(await call(view, 'wait_for_answer', { task: 'T-001' })).toEqual({
    text: 'This chat does not wait',
    isError: true,
  })
})
