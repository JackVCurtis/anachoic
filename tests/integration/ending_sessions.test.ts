import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { BoardProps } from '../../shared/props.js'
import { connect, query, SERVER, textOf } from './support/server.js'

/** The budget Claude Code gives every SessionEnd hook together. */
const HOOK_BUDGET_MS = 1500

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

async function board() {
  const result = await chat.callTool({ name: 'get_board', arguments: {} })
  return result.structuredContent as BoardProps
}

/**
 * Runs the server as a SessionEnd hook would, with `input` on stdin.
 */
function sessionEnded(input: string) {
  return new Promise<{ code: number | null; ms: number }>((resolve, reject) => {
    const started = Date.now()
    const child = spawn(process.execPath, [SERVER, '--session-ended'], {
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir },
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    child.on('error', reject)
    child.on('exit', (code) => resolve({ code, ms: Date.now() - started }))
    child.stdin.end(input)
  })
}

function logEntries() {
  const logs = join(dataDir, 'logs')
  return readdirSync(logs)
    .flatMap((file) => readFileSync(join(logs, file), 'utf8').split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  chat = await open('claude-ai')
  api = await open('claude-code', {
    CLAUDE_CODE_SESSION_ID: 'worker-a',
    CLAUDE_PROJECT_DIR: '/w/api-server',
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

describe('--session-ended', () => {
  test('removes the worker the hook names from the board and returns its step to the queue', async () => {
    const before = await board()
    expect(before.sessions.map(({ id }) => id)).toContain('worker-a')

    const hook = JSON.stringify({
      session_id: 'worker-a',
      transcript_path: '/secret/transcript.jsonl',
      cwd: '/w/api-server',
      hook_event_name: 'SessionEnd',
      reason: 'prompt_input_exit',
    })
    const { code, ms } = await sessionEnded(hook)

    expect(code).toBe(0)
    expect(ms).toBeLessThan(HOOK_BUDGET_MS)
    const after = await board()
    expect(after.sessions.map(({ id }) => id)).not.toContain('worker-a')
    expect(after.queue.map(({ task }) => task.displayId)).toEqual(['T-001'])
    expect(after.working).toEqual([])
    expect(logEntries().find(({ event }) => event === 'session_ended')).toMatchObject({
      sessionId: 'worker-a',
      removed: true,
      tasks: [1],
    })
    expect(JSON.stringify(logEntries())).not.toContain('/secret/transcript.jsonl')
  })

  test.each([['garbage'], [''], ['{"reason":"other"}']])(
    'with %j on stdin exits 0 and logs the failure',
    async (input) => {
      const { code } = await sessionEnded(input)
      expect(code).toBe(0)
      expect(logEntries().find(({ event }) => event === 'session_ended_failed')).toMatchObject({
        reason: expect.stringMatching(/not JSON|no session_id/),
      })
      expect(query(dataDir, 'SELECT removed_at FROM sessions WHERE id = ?', 'worker-a')).toEqual([
        { removed_at: null },
      ])
    }
  )
})

describe('leave_board', () => {
  test('removes the calling worker and returns its claims to the queue', async () => {
    expect(await call(api, 'leave_board')).toEqual({
      text: 'Left the board. Your claims went back to the queue.',
      isError: false,
    })
    const after = await board()
    expect(after.sessions.map(({ id }) => id)).not.toContain('worker-a')
    expect(after.queue.map(({ task }) => task.displayId)).toEqual(['T-001'])

    await call(api, 'join_board')
    const revived = await board()
    expect(revived.sessions.map(({ id }) => id)).toContain('worker-a')
  })

  test('is refused for the dedicated session', async () => {
    expect(await call(chat, 'leave_board')).toEqual({
      text: 'This chat cannot be removed',
      isError: true,
    })
  })
})

describe('remove_session', () => {
  test('removes a worker and returns the fresh board props', async () => {
    const result = await chat.callTool({
      name: 'remove_session',
      arguments: { session: 'worker-a' },
    })
    expect(result.isError).toBeFalsy()
    expect(textOf(result)).toBe('Removed api-server, from T-001')
    const props = result.structuredContent as BoardProps
    expect(props.sessions.map(({ id }) => id)).not.toContain('worker-a')
    expect(props.queue.map(({ task }) => task.displayId)).toEqual(['T-001'])
  })

  test.each([
    ['dedicated', 'This chat cannot be removed'],
    ['nobody', 'Session nobody does not exist'],
  ])('refuses %s with its sentence', async (session, sentence) => {
    const result = await chat.callTool({ name: 'remove_session', arguments: { session } })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe(sentence)
  })

  test('is absent from the model’s tools/list, where leave_board is listed', async () => {
    for (const client of [chat, api]) {
      const { tools } = await client.listTools()
      const names = tools.map(({ name }) => name)
      expect(names).toContain('leave_board')
      const remove = tools.find(({ name }) => name === 'remove_session')
      expect(remove?._meta?.ui).toMatchObject({ visibility: ['app'] })
    }
  })
})
