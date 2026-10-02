import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

const MODEL_TOOLS = [
  'add_task',
  'queue_task',
  'add_follow_up',
  'claim_step',
  'update_step',
  'ask_you',
  'complete_step',
]

let dataDir: string
const clients: Client[] = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function worker(id: string, project: string) {
  const client = await connect({
    dataDir,
    clientName: 'claude-code',
    env: { CLAUDE_CODE_SESSION_ID: id, CLAUDE_PROJECT_DIR: `/w/${project}` },
  })
  clients.push(client)
  return client
}

/**
 * Calls a tool and returns its one text block and whether it is an error,
 * checking that a model tool never returns structured content.
 */
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  expect(result.structuredContent).toBeUndefined()
  return { text: textOf(result), isError: result.isError ?? false }
}

async function ok(client: Client, name: string, args: Record<string, unknown> = {}) {
  const { text, isError } = await call(client, name, args)
  expect(isError, text).toBe(false)
  return text
}

/**
 * Every row that the board's tasks, steps and events hold.
 */
function boardRows() {
  return {
    tasks: query(dataDir, 'SELECT * FROM tasks ORDER BY id'),
    steps: query(dataDir, 'SELECT * FROM steps ORDER BY id'),
    events: query(dataDir, 'SELECT * FROM events ORDER BY id'),
  }
}

const TWO_AGENT_STEPS = {
  title: 'Add retries',
  steps: [
    { title: 'Write the retry helper', owner: 'agent', detail: 'Exponential backoff, 3 tries' },
    { title: 'Use it in the client', owner: 'agent' },
  ],
}

test('a worker adds a two-step chain, claims, notes and completes each step, and the task is done', async () => {
  const api = await worker('worker-a', 'api-server')

  expect(await ok(api, 'add_task', TWO_AGENT_STEPS)).toBe('Added T-001 to the queue at position 1')

  const claimed = await ok(api, 'claim_step')
  expect(claimed.split('\n')).toEqual([
    'Claimed T-001 step 1 of 2: "Write the retry helper"',
    'Task: "Add retries"',
    'Detail: Exponential backoff, 3 tries',
    'Done so far: none',
    'After this step:',
    '2. "Use it in the client" (agent)',
    'Next: do the step. Call update_step with task T-001 to note progress, ask_you if you need an answer from the person, and complete_step with task T-001, a summary and links when it is done.',
  ])

  expect(await ok(api, 'update_step', { task: 'T-001', note: 'Helper written' })).toBe(
    'Noted on T-001 step 1'
  )
  expect(
    await ok(api, 'complete_step', {
      task: 1,
      summary: 'Added retry() with backoff',
      links: [{ label: 'PR', url: 'https://example.com/pr/1' }],
    })
  ).toBe(
    'Completed T-001 step 1. T-001 is back in the queue at position 1. Call claim_step with task T-001 to continue it.'
  )

  const second = await ok(api, 'claim_step', { task: 'T-001' })
  expect(second).toContain('Claimed T-001 step 2 of 2: "Use it in the client"')
  expect(second).toContain('1. "Write the retry helper" (agent): Added retry() with backoff')

  expect(await ok(api, 'complete_step', { task: 'T-001', summary: 'Client retries' })).toBe(
    'Completed T-001 step 2. T-001 is done.'
  )
  expect(query(dataDir, 'SELECT status, created_by FROM tasks')).toEqual([
    { status: 'done', created_by: 'worker-a' },
  ])
})

test('add_task, queue_task and add_follow_up say where the task went', async () => {
  const api = await worker('worker-a', 'api-server')

  expect(await ok(api, 'add_task', { ...TWO_AGENT_STEPS, queue: false })).toBe(
    'Added T-001 to the backlog'
  )
  expect(
    await ok(api, 'add_task', { title: 'Review', steps: [{ title: 'Read it', owner: 'you' }] })
  ).toBe('Added T-002. T-002 is active: step 1 "Read it" waits on you')
  expect(await ok(api, 'queue_task', { task: 'T-001' })).toBe('T-001 is in the queue at position 1')

  await ok(api, 'add_task', { title: 'One step', steps: [{ title: 'Do it', owner: 'agent' }] })
  await ok(api, 'claim_step', { task: 3 })
  await ok(api, 'complete_step', { task: 3, summary: 'Done' })
  expect(
    await ok(api, 'add_follow_up', {
      task: 'T-003',
      steps: [
        { title: 'Fix', owner: 'agent' },
        { title: 'Check', owner: 'you' },
      ],
      placement: 'first',
    })
  ).toBe('T-003 is back in the queue at position 1 with 2 new steps')
})

test('two workers claiming at once on a one-task queue: exactly one gets the step', async () => {
  const [a, b] = await Promise.all([worker('worker-a', 'api'), worker('worker-b', 'web')])
  await ok(a, 'add_task', { title: 'Only', steps: [{ title: 'One', owner: 'agent' }] })

  const results = await Promise.all([call(a, 'claim_step'), call(b, 'claim_step')])

  expect(results.filter(({ isError }) => !isError)).toHaveLength(1)
  expect(results.filter(({ isError }) => isError)).toEqual([
    { text: 'Nothing in the queue needs an agent', isError: true },
  ])
})

test('a worker acting on another worker’s step is refused and nothing changes', async () => {
  const [a, b] = await Promise.all([worker('worker-a', 'api-server'), worker('worker-b', 'web')])
  await ok(a, 'add_task', TWO_AGENT_STEPS)
  await ok(a, 'claim_step')
  await ok(b, 'join_board')
  const before = boardRows()

  const refused = { text: 'Step 1 of T-001 is claimed by api-server', isError: true }
  expect(await call(b, 'update_step', { task: 'T-001', note: 'Mine now' })).toEqual(refused)
  expect(await call(b, 'ask_you', { task: 'T-001', question: 'Which?' })).toEqual(refused)
  expect(await call(b, 'complete_step', { task: 'T-001', summary: 'Done' })).toEqual(refused)

  expect(boardRows()).toEqual(before)
})

test('complete_step on a step waiting on you is refused as unanswered', async () => {
  const api = await worker('worker-a', 'api-server')
  await ok(api, 'add_task', TWO_AGENT_STEPS)
  await ok(api, 'claim_step')

  expect(await ok(api, 'ask_you', { task: 'T-001', question: 'Three tries or five?' })).toBe(
    'Asked. Call wait_for_answer with task T-001 next.'
  )
  expect(await call(api, 'complete_step', { task: 'T-001', summary: 'Done' })).toEqual({
    text: 'Step 1 of T-001 is waiting for your answer',
    isError: true,
  })
})

test('ask_you from the dedicated session is refused, and a worker’s still works', async () => {
  const chat = await connect({ dataDir, clientName: 'claude-ai' })
  clients.push(chat)
  await ok(chat, 'add_task', TWO_AGENT_STEPS)
  await ok(chat, 'claim_step')
  const before = boardRows()

  expect(await call(chat, 'ask_you', { task: 'T-001', question: 'Which?' })).toEqual({
    text: 'Ask in this chat instead',
    isError: true,
  })
  expect(boardRows()).toEqual(before)

  const api = await worker('worker-a', 'api-server')
  await ok(api, 'add_task', TWO_AGENT_STEPS)
  await ok(api, 'claim_step', { task: 'T-002' })
  expect(await ok(api, 'ask_you', { task: 'T-002', question: 'Which?' })).toBe(
    'Asked. Call wait_for_answer with task T-002 next.'
  )
})

test.each([
  ['add_task', { title: '', steps: [{ title: 'A', owner: 'agent' }] }, 'title'],
  [
    'add_task',
    { title: 'Many', steps: Array.from({ length: 21 }, () => ({ title: 'A', owner: 'agent' })) },
    'steps',
  ],
  ['update_step', { task: 'T-001', note: 'x'.repeat(501) }, 'note'],
])(
  '%s with invalid input is refused by its schema, naming the field',
  async (name, args, field) => {
    const api = await worker('worker-a', 'api-server')

    const { text, isError } = await call(api, name, args)
    expect(isError).toBe(true)
    expect(text).toContain('Input validation error')
    expect(text).toContain(field)
    expect(query(dataDir, 'SELECT id FROM tasks')).toEqual([])
  }
)

test('a claude-code client sees every model tool, none of them for the view only', async () => {
  const api = await worker('worker-a', 'api-server')

  const { tools } = await api.listTools()
  for (const name of MODEL_TOOLS) {
    const tool = tools.find((each) => each.name === name)
    expect(tool, name).toBeDefined()
    expect(tool?._meta?.ui, name).toBeUndefined()
    expect(tool?.inputSchema.properties, name).toHaveProperty('session')
  }
})
