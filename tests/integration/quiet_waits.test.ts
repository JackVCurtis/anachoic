import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, textOf } from './support/server.js'

const WAIT_MS = 30_000
const POLL_MS = 50

let dataDir: string
const clients: Client[] = []

async function worker(id: string) {
  const client = await connect({
    dataDir,
    clientName: 'claude-code',
    env: {
      CLAUDE_CODE_SESSION_ID: id,
      CLAUDE_PROJECT_DIR: `/w/${id}`,
      ANACHOIC_WAIT_POLL_MS: String(POLL_MS),
      ANACHOIC_WAIT_TIMEOUT_MS: String(WAIT_MS),
    },
  })
  clients.push(client)
  return client
}

/**
 * The log lines a session's process wrote from `since` on.
 */
function linesOf(sessionId: string, since: string) {
  const logs = join(dataDir, 'logs')
  return readdirSync(logs)
    .flatMap((file) => readFileSync(join(logs, file), 'utf8').split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { time: string; sessionId?: string; event: string })
    .filter((entry) => entry.sessionId === sessionId && entry.time >= since)
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

test('a 30-second wait polling every 50 ms writes no more than three log lines', async () => {
  const asking = await worker('worker-asking')
  const idle = await worker('worker-idle')
  await asking.callTool({
    name: 'add_task',
    arguments: { title: 'Cache', steps: [{ title: 'Pick a cache', owner: 'agent' }] },
  })
  await asking.callTool({ name: 'claim_step', arguments: { task: 'T-001' } })
  await asking.callTool({
    name: 'ask_you',
    arguments: { task: 'T-001', question: 'Redis or in-process?' },
  })
  await idle.callTool({ name: 'join_board', arguments: { name: 'idle' } })
  const since = new Date().toISOString()

  const [answer, work] = await Promise.all([
    asking.callTool({ name: 'wait_for_answer', arguments: { task: 'T-001' } }),
    idle.callTool({ name: 'wait_for_work', arguments: {} }),
  ])

  expect(textOf(answer)).toBe('No answer yet. Call wait_for_answer again to keep waiting.')
  expect(textOf(work)).toBe('No work yet. Call wait_for_work again to keep waiting.')
  expect(linesOf('worker-asking', since).map((entry) => entry.event)).toEqual([
    'wait_start',
    'wait_end',
  ])
  expect(linesOf('worker-idle', since).map((entry) => entry.event)).toEqual([
    'work_wait_start',
    'work_wait_end',
  ])
}, 60_000)
