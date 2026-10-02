import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { boardPropsSchema } from '../../shared/props.js'
import { connect, query, textOf } from './support/server.js'

const VIEW_ACTIONS = [
  'add_task_from_view',
  'queue_task_from_view',
  'reorder_queue',
  'move_to_backlog',
  'complete_my_step',
  'answer_question',
  'sign_off',
  'add_follow_up_from_view',
  'archive_task',
]

let dataDir: string
let view: Client
const clients: Client[] = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  view = await connect({ dataDir, clientName: 'claude-ai' })
  clients.push(view)
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function worker(id = 'worker-a', project = 'api-server') {
  const client = await connect({
    dataDir,
    clientName: 'claude-code',
    env: { CLAUDE_CODE_SESSION_ID: id, CLAUDE_PROJECT_DIR: `/w/${project}` },
  })
  clients.push(client)
  return client
}

function revision() {
  return query<{ revision: number }>(dataDir, 'SELECT revision FROM board')[0].revision
}

function lastEventId() {
  return query<{ id: number | null }>(dataDir, 'SELECT max(id) AS id FROM events')[0].id ?? 0
}

function boardRows() {
  return {
    board: query(dataDir, 'SELECT * FROM board'),
    tasks: query(dataDir, 'SELECT * FROM tasks ORDER BY id'),
    steps: query(dataDir, 'SELECT * FROM steps ORDER BY id'),
    events: query(dataDir, 'SELECT * FROM events ORDER BY id'),
  }
}

/**
 * Calls one of your actions from the view and checks what every success
 * shares: one line of text, the board props one revision on, and events
 * that name you. Returns the props and the event kinds appended.
 */
async function act(name: string, args: Record<string, unknown>) {
  const before = revision()
  const since = lastEventId()
  const result = await view.callTool({ name, arguments: args })
  const text = textOf(result)
  expect(result.isError, text).toBeFalsy()
  expect(text).not.toContain('\n')
  const props = boardPropsSchema.parse(result.structuredContent)
  expect(props.revision).toBe(before + 1)
  const events = query<{ kind: string; session_id: string }>(
    dataDir,
    'SELECT kind, session_id FROM events WHERE id > ? ORDER BY id',
    since
  )
  expect(events.length).toBeGreaterThan(0)
  expect(events.map((event) => event.session_id)).toEqual(events.map(() => 'you'))
  return { props, text, kinds: events.map((event) => event.kind) }
}

async function ok(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  expect(result.isError, textOf(result)).toBeFalsy()
  return textOf(result)
}

function task(id: number) {
  return query<Record<string, unknown>>(dataDir, 'SELECT * FROM tasks WHERE id = ?', id)[0]
}

function step(id: string) {
  return query<Record<string, unknown>>(dataDir, 'SELECT * FROM steps WHERE id = ?', id)[0]
}

const AGENT_STEP = { title: 'Write it', owner: 'agent' }
const YOUR_STEP = { title: 'Review it', owner: 'you' }

test.each(['claude-ai', 'claude-code'])(
  'a %s client lists the nine actions for the view only',
  async (clientName) => {
    const client =
      clientName === 'claude-ai' ? view : await connect({ dataDir, clientName, env: {} })
    if (client !== view) clients.push(client)

    const { tools } = await client.listTools()
    for (const name of VIEW_ACTIONS) {
      const tool = tools.find((each) => each.name === name)
      expect(tool?._meta, name).toMatchObject({ ui: { visibility: ['app'] } })
      expect(tool?._meta?.ui, name).not.toHaveProperty('resourceUri')
    }
  }
)

test('each action performs its transition as you and returns the next board', async () => {
  const api = await worker()

  const added = await act('add_task_from_view', {
    title: 'Add retries',
    steps: [AGENT_STEP, { title: 'Use it', owner: 'agent' }],
    queue: false,
  })
  expect(added.text).toBe('Added T-001 to the backlog')
  expect(added.kinds).toEqual(['added'])
  expect(added.props.backlog.map((item) => item.task.displayId)).toEqual(['T-001'])
  expect(task(1)).toMatchObject({ status: 'backlog', created_by: 'you' })

  const queued = await act('queue_task_from_view', { task: 'T-001' })
  expect(queued.kinds).toEqual(['queued'])
  expect(task(1)).toMatchObject({ status: 'queue', queue_position: 1 })

  await act('add_task_from_view', { title: 'Second', steps: [AGENT_STEP] })
  expect(task(2)).toMatchObject({ status: 'queue', queue_position: 2, created_by: 'you' })

  const reordered = await act('reorder_queue', { task: 'T-002', position: 1 })
  expect(reordered.kinds).toEqual(['reordered'])
  expect(reordered.props.queue.map(({ task: ref, position }) => [ref.displayId, position])).toEqual(
    [
      ['T-002', 1],
      ['T-001', 2],
    ]
  )

  const unqueued = await act('move_to_backlog', { task: 2 })
  expect(unqueued.text).toBe('Moved T-002 to the backlog')
  expect(task(2)).toMatchObject({ status: 'backlog', queue_position: null })
  expect(task(1)).toMatchObject({ queue_position: 1 })

  await ok(api, 'claim_step', { task: 'T-001' })
  const parked = await act('move_to_backlog', { task: 'T-001' })
  expect(parked.text).toBe('Parked T-001 in the backlog')
  expect(parked.kinds).toEqual(['parked'])
  expect(task(1)).toMatchObject({ status: 'backlog' })
  expect(step('1.1')).toMatchObject({ status: 'pending', claimed_by: null })

  await act('add_task_from_view', { title: 'Review', steps: [YOUR_STEP] })
  expect(task(3)).toMatchObject({ status: 'active' })
  const marked = await act('complete_my_step', { task: 'T-003', note: 'Looks good' })
  expect(marked.text).toBe('Marked T-003 step 1 done')
  expect(marked.kinds).toEqual(['completed'])
  expect(step('3.1')).toMatchObject({ status: 'done', note: 'Looks good' })
  expect(task(3)).toMatchObject({ status: 'done' })

  const signed = await act('sign_off', { task: 'T-003' })
  expect(signed.kinds).toEqual(['signed_off'])
  expect(task(3).signed_off_at).not.toBeNull()
  expect(signed.props.signedOff.map((item) => item.task.displayId)).toEqual(['T-003'])

  await act('add_task_from_view', { title: 'Fourth', steps: [AGENT_STEP] })
  await ok(api, 'claim_step', { task: 'T-004' })
  await ok(api, 'complete_step', { task: 'T-004', summary: 'Done' })
  const followed = await act('add_follow_up_from_view', {
    task: 'T-004',
    steps: [AGENT_STEP, YOUR_STEP],
    placement: 'first',
  })
  expect(followed.text).toBe('T-004 is back in the queue at position 1 with 2 new steps')
  expect(followed.kinds).toEqual(['followed_up', 'queued'])

  const archived = await act('archive_task', { task: 'T-002' })
  expect(archived.text).toBe('Archived T-002')
  expect(task(2).archived_at).not.toBeNull()
  expect(archived.props.backlog.map((item) => item.task.displayId)).toEqual(['T-001'])
})

test('answer_question makes the waiting step run again with the answer for its worker', async () => {
  const api = await worker()
  await act('add_task_from_view', { title: 'Cache', steps: [AGENT_STEP] })
  await ok(api, 'claim_step')
  await ok(api, 'ask_you', { task: 'T-001', question: 'Redis or in-process?' })

  const answered = await act('answer_question', { task: 'T-001', answer: 'Redis' })

  expect(answered.text).toBe('Answered T-001 step 1')
  expect(answered.kinds).toEqual(['answered'])
  expect(step('1.1')).toMatchObject({
    status: 'running',
    claimed_by: 'worker-a',
    question: null,
    answer: 'Redis',
  })
  expect(answered.props.working.map((item) => item.task.displayId)).toEqual(['T-001'])
})

test('archive_task on a claimed task clears the claim, and the worker is told on its next call', async () => {
  const api = await worker()
  await act('add_task_from_view', { title: 'Cache', steps: [AGENT_STEP] })
  await ok(api, 'claim_step')

  await act('archive_task', { task: 'T-001' })
  expect(step('1.1')).toMatchObject({ status: 'pending', claimed_by: null })

  const refused = await api.callTool({
    name: 'update_step',
    arguments: { task: 'T-001', note: 'Still going' },
  })
  expect(refused.isError).toBe(true)
  expect(textOf(refused)).toBe('T-001 was archived')
})

test.each([
  [
    'complete_my_step on an agent’s waiting step',
    'complete_my_step',
    { task: 'T-001' },
    "Step 1 of T-001 is an agent's, not yours",
  ],
  [
    'reorder_queue on a backlog task',
    'reorder_queue',
    { task: 'T-002', position: 1 },
    'T-002 is in the backlog, not in the queue',
  ],
  ['sign_off on an active task', 'sign_off', { task: 'T-001' }, 'T-001 is active, not done'],
])('%s is refused and changes nothing', async (_case, name, args, sentence) => {
  const api = await worker()
  await act('add_task_from_view', { title: 'Cache', steps: [AGENT_STEP] })
  await act('add_task_from_view', { title: 'Later', steps: [AGENT_STEP], queue: false })
  await ok(api, 'claim_step', { task: 'T-001' })
  await ok(api, 'ask_you', { task: 'T-001', question: 'Which?' })
  const before = boardRows()

  const result = await view.callTool({ name, arguments: args })

  expect(result.isError).toBe(true)
  expect(textOf(result)).toBe(sentence)
  expect(result.structuredContent).toBeUndefined()
  expect(boardRows()).toEqual(before)
})
