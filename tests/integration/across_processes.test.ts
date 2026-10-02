import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { actionResultSchema } from '../../shared/props.js'
import { connectProcess, query, textOf } from './support/server.js'

const HEARTBEAT_MS = 100
const DEAD_WINDOW_MS = 1500
const LIVENESS_ENV = {
  ANACHOIC_HEARTBEAT_MS: String(HEARTBEAT_MS),
  ANACHOIC_DEAD_WINDOW_MS: String(DEAD_WINDOW_MS),
}

let dataDir: string
const processes: Array<{ client: Client; pid: number }> = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await Promise.all(processes.splice(0).map(({ client }) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function open(clientName: string, env: Record<string, string> = {}) {
  const started = await connectProcess({ dataDir, clientName, env })
  processes.push(started)
  return started
}

function worker(id: string, env: Record<string, string> = {}) {
  return open('claude-code', {
    CLAUDE_CODE_SESSION_ID: id,
    CLAUDE_PROJECT_DIR: `/w/${id}`,
    ...env,
  })
}

async function ok(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  expect(result.isError, textOf(result)).toBeFalsy()
  return result
}

function revision() {
  return query<{ revision: number }>(dataDir, 'SELECT revision FROM board')[0].revision
}

/**
 * Waits until `condition` holds, reading the database every 50 ms, and gives
 * how long that took.
 */
async function until(condition: () => boolean, timeoutMs: number) {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting')
    await sleep(50)
  }
  return Date.now() - started
}

/**
 * Kills a server process at once, as a crash or a closed terminal would,
 * and waits for it to be gone.
 */
async function kill({ client, pid }: { client: Client; pid: number }) {
  const closed = new Promise<void>((resolve) => {
    client.onclose = () => resolve()
  })
  process.kill(pid, 'SIGKILL')
  await closed
}

describe('two processes claiming the same step', () => {
  /*
   * Each write holds the lock a while before it commits, so the second
   * claimer reads the board while the first claim is still being written.
   * A claim whose read is not inside its write then takes the step twice.
   */
  const HOLD_ENV = { ANACHOIC_TEST_HOLD_WRITE_MS: '300' }

  test('exactly one wins, and the other is told there is nothing to claim', async () => {
    const [a, b] = await Promise.all([worker('worker-a', HOLD_ENV), worker('worker-b', HOLD_ENV)])
    await ok(a.client, 'join_board')
    await ok(b.client, 'join_board')
    await ok(a.client, 'add_task', { title: 'Only', steps: [{ title: 'One', owner: 'agent' }] })

    const results = await Promise.all(
      [a, b].map(async ({ client }) => {
        const result = await client.callTool({ name: 'claim_step', arguments: {} })
        return { text: textOf(result), isError: result.isError ?? false }
      })
    )

    expect(results.filter(({ isError }) => !isError)).toHaveLength(1)
    expect(results.filter(({ isError }) => isError)).toEqual([
      { text: 'Nothing in the queue needs an agent', isError: true },
    ])
    expect(query(dataDir, "SELECT count(*) AS n FROM events WHERE kind = 'claimed'")).toEqual([
      { n: 1 },
    ])
  })
})

describe('writes from eight processes at once', () => {
  test('all succeed, with no busy refusal, and the revisions they return are contiguous', async () => {
    const WRITERS = 8
    const WRITES = 10
    const writers = await Promise.all(
      Array.from({ length: WRITERS }, (_, index) => worker(`writer-${index + 1}`))
    )
    for (const { client } of writers) await ok(client, 'join_board')
    const start = revision()

    const results = await Promise.all(
      writers.map(async ({ client }, writer) => {
        const revisions: number[] = []
        for (let index = 0; index < WRITES; index += 1) {
          const result = await client.callTool({
            name: 'add_task_from_view',
            arguments: {
              title: `Task ${writer + 1}.${index + 1}`,
              steps: [{ title: 'Do it', owner: 'agent' }],
            },
          })
          expect(result.isError, textOf(result)).toBeFalsy()
          revisions.push(actionResultSchema.parse(result.structuredContent).revision)
        }
        return revisions
      })
    )

    const revisions = results.flat().sort((a, b) => a - b)
    const total = WRITERS * WRITES
    expect(revisions).toEqual(Array.from({ length: total }, (_, index) => start + index + 1))
    expect(revision()).toBe(start + total)
    expect(
      query<{ position: number }>(
        dataDir,
        "SELECT queue_position AS position FROM tasks WHERE status = 'queue' ORDER BY 1"
      ).map(({ position }) => position)
    ).toEqual(Array.from({ length: total }, (_, index) => index + 1))
    expect(query(dataDir, "SELECT count(*) AS n FROM events WHERE kind = 'added'")).toEqual([
      { n: total },
    ])
  }, 60_000)
})

describe('liveness, with the dead window shortened', () => {
  async function boardWithClaim() {
    const chat = await open('claude-ai', LIVENESS_ENV)
    const api = await worker('worker-a', LIVENESS_ENV)
    await ok(chat.client, 'add_task', {
      title: 'Add retries',
      steps: [{ title: 'Write it', owner: 'agent' }],
    })
    await ok(chat.client, 'add_task', {
      title: 'Second',
      steps: [{ title: 'Do it', owner: 'agent' }],
    })
    const claimed = await ok(api.client, 'claim_step')
    expect(textOf(claimed)).toMatch(/^Claimed T-001 step 1 of 1/)
    expect(query(dataDir, "SELECT id, queue_position FROM tasks WHERE status = 'queue'")).toEqual([
      { id: 2, queue_position: 1 },
    ])
    return { chat, api }
  }

  test('a killed worker’s claim is released to queue position 1 within the window, with a released event', async () => {
    const { api } = await boardWithClaim()

    await kill(api)
    const waited = await until(
      () =>
        query<{ status: string }>(dataDir, "SELECT status FROM steps WHERE id = '1.1'")[0]
          .status === 'pending',
      DEAD_WINDOW_MS * 4
    )

    expect(waited).toBeLessThan(DEAD_WINDOW_MS + 1000)
    expect(query(dataDir, 'SELECT id, status, queue_position FROM tasks ORDER BY id')).toEqual([
      { id: 1, status: 'queue', queue_position: 1 },
      { id: 2, status: 'queue', queue_position: 2 },
    ])
    expect(query(dataDir, "SELECT claimed_by FROM steps WHERE id = '1.1'")).toEqual([
      { claimed_by: null },
    ])
    expect(
      query(dataDir, "SELECT task_id, step_id, session_id FROM events WHERE kind = 'released'")
    ).toEqual([{ task_id: 1, step_id: '1.1', session_id: 'worker-a' }])
    expect(
      query<{ ended_at: string | null }>(
        dataDir,
        "SELECT ended_at FROM sessions WHERE id = 'worker-a'"
      )[0].ended_at
    ).not.toBeNull()
  })

  test('a process restarted under the same session id keeps the session and its claim', async () => {
    const { api } = await boardWithClaim()

    await kill(api)
    const again = await worker('worker-a', LIVENESS_ENV)
    await ok(again.client, 'update_step', { task: 'T-001', note: 'Back after a restart' })
    await sleep(DEAD_WINDOW_MS * 2)

    expect(query(dataDir, "SELECT status, claimed_by FROM steps WHERE id = '1.1'")).toEqual([
      { status: 'running', claimed_by: 'worker-a' },
    ])
    expect(query(dataDir, "SELECT ended_at FROM sessions WHERE id = 'worker-a'")).toEqual([
      { ended_at: null },
    ])
    expect(query(dataDir, "SELECT count(*) AS n FROM events WHERE kind = 'released'")).toEqual([
      { n: 0 },
    ])
    expect(
      textOf(await ok(again.client, 'complete_step', { task: 'T-001', summary: 'Done' }))
    ).toMatch(/^Completed T-001 step 1/)
  })

  test('a session id that comes back after it was released is live again, and its claim stays released', async () => {
    const { api } = await boardWithClaim()
    await kill(api)
    await until(
      () => query(dataDir, "SELECT 1 FROM events WHERE kind = 'released'").length === 1,
      DEAD_WINDOW_MS * 4
    )

    const again = await worker('worker-a', LIVENESS_ENV)
    await ok(again.client, 'join_board')

    expect(query(dataDir, "SELECT ended_at FROM sessions WHERE id = 'worker-a'")).toEqual([
      { ended_at: null },
    ])
    expect(query(dataDir, "SELECT status, claimed_by FROM steps WHERE id = '1.1'")).toEqual([
      { status: 'pending', claimed_by: null },
    ])
    const refused = await again.client.callTool({
      name: 'update_step',
      arguments: { task: 'T-001', note: 'Still here?' },
    })
    expect(refused.isError).toBe(true)
  })
})
