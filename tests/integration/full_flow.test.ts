import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { historyPropsSchema, type BoardProps } from '../../shared/props.js'
import { connect, query, SERVER, textOf } from './support/server.js'

const POLL_MS = 200
const WAIT_ENV = {
  ANACHOIC_WAIT_POLL_MS: String(POLL_MS),
  ANACHOIC_WAIT_PROGRESS_MS: '1000',
  ANACHOIC_WAIT_TIMEOUT_MS: '5000',
}
const PR = 'https://github.com/acme/api/pull/7'

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

async function ok(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await call(client, name, args)
  expect(result.isError, result.text).toBe(false)
  return result.text
}

async function board() {
  const result = await chat.callTool({ name: 'get_board', arguments: {} })
  return result.structuredContent as BoardProps
}

function stepRow(id: string) {
  return query<Record<string, unknown>>(dataDir, 'SELECT * FROM steps WHERE id = ?', id)[0]
}

/**
 * Runs the server as a SessionEnd hook would for `sessionId`.
 */
function sessionEnded(sessionId: string) {
  return new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER, '--session-ended'], {
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir },
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    child.on('error', reject)
    child.on('exit', resolve)
    child.stdin.end(
      JSON.stringify({ session_id: sessionId, hook_event_name: 'SessionEnd', reason: 'logout' })
    )
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
  await ok(api, 'join_board')
  await ok(web, 'join_board')
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

test('a chain assigned to one worker runs to sign-off through a hand-back, a question and a block, and lands in the history', async () => {
  await ok(chat, 'add_task', {
    title: 'Add retries',
    assign_to: 'api-server',
    steps: [
      { title: 'Open the PR', owner: 'agent', output_format: 'pull_request' },
      { title: 'Review the PR', owner: 'user' },
      { title: 'Merge it', owner: 'agent' },
    ],
  })

  expect(await call(web, 'claim_step')).toEqual({
    text: 'Nothing in the queue needs an agent',
    isError: true,
  })
  expect(await call(web, 'claim_step', { task: 'T-001' })).toEqual({
    text: 'T-001 is assigned to api-server',
    isError: true,
  })

  const claimed = await ok(api, 'claim_step')
  expect(claimed).toMatch(/^Claimed T-001 step 1 of 3: "Open the PR"/)
  expect(claimed).toContain('Produces: a pull request. Finish with complete_step and artifact_url.')

  const intruder = await call(web, 'update_step', { task: 'T-001', note: 'Mine now' })
  expect(intruder.isError).toBe(true)
  expect(intruder.text).toContain('is claimed by')
  expect(stepRow('1.1')).toMatchObject({ status: 'running', claimed_by: 'worker-a', note: null })

  expect(await call(api, 'complete_step', { task: 'T-001', summary: 'Opened it' })).toEqual({
    text: 'Step 1 of T-001 needs a pull request link (artifact_url)',
    isError: true,
  })
  expect(
    await ok(api, 'complete_step', { task: 'T-001', summary: 'Opened it', artifact_url: PR })
  ).toBe(
    "Completed T-001 step 1. Step 2 of T-001 is the user's. Call wait_for_work to be told when this task needs an agent again."
  )
  const review = await board()
  expect(review.yourTurn).toHaveLength(1)
  expect(review.yourTurn[0].input).toEqual({ stepNumber: 1, format: 'pull_request', url: PR })

  const handBack = call(api, 'wait_for_work')
  await sleep(POLL_MS * 2)
  await ok(chat, 'complete_my_step', { task: 'T-001', note: 'Looks good' })
  expect(await handBack).toEqual({
    text: 'The user finished step 2 of T-001, “Review the PR”. Note: Looks good. Call claim_step with task T-001 to continue it.',
    isError: false,
  })

  const merge = await ok(api, 'claim_step', { task: 'T-001' })
  expect(merge).toMatch(/^Claimed T-001 step 3 of 3: "Merge it"/)
  expect(merge).toContain(`Artifacts:\nStep 1 (agent): Pull request ${PR}`)

  await ok(api, 'ask_you', { task: 'T-001', question: 'Squash or merge?' })
  const asked = await board()
  expect(asked.yourTurn[0]).toMatchObject({
    task: { displayId: 'T-001' },
    session: { id: 'worker-a' },
  })
  const answer = call(api, 'wait_for_answer', { task: 'T-001' })
  await sleep(POLL_MS * 2)
  await ok(chat, 'answer_question', { task: 'T-001', answer: 'Squash' })
  expect(await answer).toEqual({
    text: 'The user answered your question on T-001:\nSquash',
    isError: false,
  })

  await ok(api, 'block_step', { task: 'T-001', reason: 'needs a maintainer to approve' })
  const blocked = await board()
  expect(blocked.yourTurn[0]).toMatchObject({
    blocked: { reason: 'needs a maintainer to approve' },
  })
  const unblockedByAnother = await call(web, 'unblock_step', { task: 'T-001', note: 'Approved' })
  expect(unblockedByAnother.isError).toBe(true)
  await ok(api, 'unblock_step', { task: 'T-001', note: 'Approved' })
  const unblocked = await board()
  expect(unblocked.yourTurn).toEqual([])

  expect(await ok(api, 'complete_step', { task: 'T-001', summary: 'Squashed and merged' })).toMatch(
    /^Completed T-001 step 3/
  )
  expect(query(dataDir, 'SELECT status, signed_off_at FROM tasks WHERE id = 1')).toEqual([
    { status: 'done', signed_off_at: null },
  ])
  const done = await board()
  expect(done.toSignOff.map(({ task }) => task.displayId)).toEqual(['T-001'])

  await ok(chat, 'sign_off', { task: 'T-001' })
  const signed = await board()
  expect(signed.toSignOff).toEqual([])
  expect(signed.signedOff.map(({ task }) => task.displayId)).toEqual(['T-001'])

  const history = await chat.callTool({ name: 'show_history', arguments: {} })
  expect(textOf(history).split('\n')[0]).toBe('1 completed task')
  const [row] = historyPropsSchema.parse(history.structuredContent).rows
  expect(row).toMatchObject({
    task: { displayId: 'T-001', title: 'Add retries' },
    workers: ['api-server'],
    artifacts: [{ stepNumber: 1, format: 'pull_request', url: PR }],
  })
  expect(
    query<{ kind: string }>(dataDir, 'SELECT kind FROM events WHERE task_id = 1 ORDER BY id').map(
      ({ kind }) => kind
    )
  ).toEqual(
    expect.arrayContaining([
      'added',
      'assigned',
      'claimed',
      'completed',
      'asked',
      'answered',
      'blocked',
      'unblocked',
      'signed_off',
    ])
  )
})

test('a worker ended by its SessionEnd hook, and one removed from the board, each give their step back to the queue', async () => {
  await ok(chat, 'add_task', { title: 'Ship it', steps: [{ title: 'Deploy', owner: 'agent' }] })
  await ok(chat, 'add_task', { title: 'Later', steps: [{ title: 'Tidy', owner: 'agent' }] })
  expect(await ok(web, 'claim_step')).toMatch(/^Claimed T-001 step 1 of 1/)

  expect(await sessionEnded('worker-b')).toBe(0)
  const afterHook = await board()
  expect(afterHook.sessions.map(({ id }) => id)).not.toContain('worker-b')
  expect(afterHook.queue.map(({ task, position }) => [task.displayId, position])).toEqual([
    ['T-001', 1],
    ['T-002', 2],
  ])
  expect(stepRow('1.1')).toMatchObject({ status: 'pending', claimed_by: null })

  expect(await ok(api, 'claim_step')).toMatch(/^Claimed T-001 step 1 of 1/)
  const removed = await chat.callTool({
    name: 'remove_session',
    arguments: { session: 'worker-a' },
  })
  expect(textOf(removed)).toBe('Removed api-server, from T-001')
  const props = removed.structuredContent as BoardProps
  expect(props.sessions.map(({ id }) => id)).not.toContain('worker-a')
  expect(props.queue.map(({ task }) => task.displayId)).toEqual(['T-001', 'T-002'])
  expect(props.working).toEqual([])

  const refused = await call(api, 'complete_step', { task: 'T-001', summary: 'Deployed' })
  expect(refused.isError).toBe(true)
  expect(stepRow('1.1')).toMatchObject({ status: 'pending', claimed_by: null })
  expect(
    query(dataDir, "SELECT session_id FROM events WHERE kind = 'released' ORDER BY id")
  ).toEqual([{ session_id: 'worker-b' }, { session_id: 'worker-a' }])
})
