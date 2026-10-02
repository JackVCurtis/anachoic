import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

const POLL_MS = 200
const PROGRESS_MS = 150
const TIMEOUT_MS = 700
/** What a result may take beyond a poll interval to cross two processes. */
const SLACK_MS = 300

const WAIT_ENV = {
  ANACHOIC_WAIT_POLL_MS: String(POLL_MS),
  ANACHOIC_WAIT_PROGRESS_MS: String(PROGRESS_MS),
  ANACHOIC_WAIT_TIMEOUT_MS: String(TIMEOUT_MS),
}

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

function addTask(assignTo?: string, title = 'Add retries') {
  return call(chat, 'add_task', {
    title,
    steps: [{ title: 'Write it', owner: 'agent' }],
    ...(assignTo === undefined ? {} : { assign_to: assignTo }),
  })
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
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

describe('add_task with assign_to', () => {
  test('assigns by name, in any case, and by id', async () => {
    expect(await addTask('API-Server')).toEqual({
      text: 'Added T-001 to the queue at position 1. It is assigned to api-server',
      isError: false,
    })
    expect(await addTask('worker-b')).toEqual({
      text: 'Added T-002 to the queue at position 2. It is assigned to web-client',
      isError: false,
    })
    expect(query(dataDir, 'SELECT id, assigned_to FROM tasks ORDER BY id')).toEqual([
      { id: 1, assigned_to: 'worker-a' },
      { id: 2, assigned_to: 'worker-b' },
    ])
  })

  test('an unknown name is refused, listing the live workers', async () => {
    expect(await addTask('docs')).toEqual({
      text: '“docs” is not a live worker. Live workers: api-server (worker-a), web-client (worker-b)',
      isError: true,
    })
    expect(query(dataDir, 'SELECT id FROM tasks')).toEqual([])
  })
})

describe('add_task_from_view with assignTo', () => {
  test('assigns to a live worker by id and returns the board with assignedTo and workers', async () => {
    const result = await chat.callTool({
      name: 'add_task_from_view',
      arguments: {
        title: 'Add retries',
        steps: [{ title: 'Write it', owner: 'agent' }],
        assignTo: 'worker-a',
      },
    })
    const props = result.structuredContent as {
      queue: Array<{ task: { assignedTo: unknown } }>
      workers: unknown
      acted: { task: { assignedTo: unknown } }
    }
    expect(props.queue[0].task.assignedTo).toEqual({ id: 'worker-a', name: 'api-server' })
    expect(props.acted.task.assignedTo).toEqual({ id: 'worker-a', name: 'api-server' })
    expect(props.workers).toEqual([
      { id: 'worker-a', name: 'api-server' },
      { id: 'worker-b', name: 'web-client' },
    ])

    const refused = await chat.callTool({
      name: 'add_task_from_view',
      arguments: {
        title: 'Add retries',
        steps: [{ title: 'Write it', owner: 'agent' }],
        assignTo: 'nobody',
      },
    })
    expect(refused.isError).toBe(true)
    expect(textOf(refused)).toBe('nobody is not a live worker')
  })
})

describe('Claiming an assigned task', () => {
  test('is refused to another worker, and claim_step() by it skips the task', async () => {
    await addTask('api-server')
    await addTask()

    expect(await call(web, 'claim_step', { task: 'T-001' })).toEqual({
      text: 'T-001 is assigned to api-server',
      isError: true,
    })
    const skipped = await call(web, 'claim_step')
    expect(skipped.text).toMatch(/^Claimed T-002 step 1 of 1/)
    expect(await call(web, 'claim_step')).toEqual({
      text: 'Nothing in the queue needs an agent',
      isError: true,
    })

    const own = await call(api, 'claim_step')
    expect(own.text).toMatch(/^Claimed T-001 step 1 of 1/)
    expect(own.text).toContain('T-001 is assigned to you')
  })
})

describe('wait_for_work', () => {
  function waitForWork(client: Client) {
    return client.callTool({ name: 'wait_for_work', arguments: {} }).then((result) => ({
      text: textOf(result),
      isError: result.isError ?? false,
      at: Date.now(),
    }))
  }

  test('returns within one poll when a task is assigned to the caller', async () => {
    const waiting = waitForWork(api)
    await sleep(POLL_MS * 2)

    await addTask('api-server')
    const addedAt = Date.now()
    const result = await waiting

    expect(result).toMatchObject({
      text: 'T-001 is assigned to you. Call claim_step with task T-001.',
      isError: false,
    })
    expect(result.at - addedAt).toBeLessThan(POLL_MS + SLACK_MS)
    expect(query(dataDir, 'SELECT status FROM steps')).toEqual([{ status: 'pending' }])
  })

  test('names an unassigned task, prefers one assigned to the caller, and ignores another’s', async () => {
    await addTask('web-client')
    await addTask()
    expect(await waitForWork(api)).toMatchObject({
      text: 'T-002 is in the queue. Call claim_step with task T-002.',
    })
    await addTask('api-server')
    expect(await waitForWork(api)).toMatchObject({
      text: 'T-003 is assigned to you. Call claim_step with task T-003.',
    })
  })

  test('sends progress at its interval and returns its own text at its timeout', async () => {
    await addTask('web-client')
    const progress: number[] = []
    const started = Date.now()

    const result = await api.callTool(
      { name: 'wait_for_work', arguments: {} },
      { onprogress: ({ progress: value }) => progress.push(value) }
    )

    expect(textOf(result)).toBe('No work yet. Call wait_for_work again to keep waiting.')
    expect(result.isError).toBeFalsy()
    expect(Date.now() - started).toBeGreaterThanOrEqual(TIMEOUT_MS)
    expect(progress.length).toBeGreaterThanOrEqual(Math.floor(TIMEOUT_MS / PROGRESS_MS) - 1)
    expect(progress).toEqual(progress.map((_value, index) => index + 1))
  })

  test('a cancelled call stops polling', async () => {
    const workLog = () => {
      const logs = join(dataDir, 'logs')
      return readdirSync(logs)
        .sort()
        .flatMap((file) => readFileSync(join(logs, file), 'utf8').split('\n'))
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { event: string; reason?: string })
        .filter((entry) => entry.event.startsWith('work_wait_'))
    }
    const controller = new AbortController()
    const cancelled = api
      .callTool({ name: 'wait_for_work', arguments: {} }, { signal: controller.signal })
      .catch((error: Error) => error)
    await sleep(POLL_MS * 2)

    controller.abort()
    expect(await cancelled).toBeInstanceOf(Error)
    await sleep(POLL_MS * 3)
    const settled = workLog()
    await sleep(POLL_MS * 3)

    expect(workLog()).toEqual(settled)
    expect(settled.at(-1)).toMatchObject({ event: 'work_wait_end', reason: 'cancelled' })
  })

  test('is refused for the dedicated session', async () => {
    expect(await call(chat, 'wait_for_work')).toEqual({
      text: 'This chat does not wait',
      isError: true,
    })
  })
})
