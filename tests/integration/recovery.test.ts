import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, SERVER, textOf } from './support/server.js'

const TABLES = ['board', 'tasks', 'steps', 'sessions', 'events']
const TASK = { title: 'Add retries', steps: [{ title: 'Write it', owner: 'agent' }] }

let dataDir: string
let file: string

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  file = join(dataDir, 'board.sqlite')
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

function snapshot() {
  return Object.fromEntries(
    TABLES.map((table) => [table, query(dataDir, `SELECT * FROM ${table} ORDER BY rowid`)])
  )
}

/**
 * True while another connection holds the write lock: this one, waiting not
 * at all, cannot take it.
 */
function writeLockHeld() {
  const probe = new DatabaseSync(file)
  try {
    probe.exec('PRAGMA busy_timeout = 0')
    probe.exec('BEGIN IMMEDIATE')
    probe.exec('ROLLBACK')
    return false
  } catch {
    return true
  } finally {
    probe.close()
  }
}

async function until(condition: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test('a server killed while it holds a write leaves every table as it was, and the next one opens the file', async () => {
  const first = await connect({ dataDir })
  const added = await first.callTool({ name: 'add_task', arguments: TASK })
  expect(added.isError).toBeFalsy()
  await first.close()
  const before = snapshot()

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    cwd: '/',
    env: { ANACHOIC_DATA_DIR: dataDir, ANACHOIC_TEST_HOLD_WRITE_MS: '30000' },
    stderr: 'ignore',
  })
  const held = new Client({ name: 'anachoic-integration', version: '0.0.0' })
  await held.connect(transport)
  const call = held.callTool({ name: 'add_task', arguments: TASK }).catch(() => undefined)
  await until(writeLockHeld, 10_000)
  process.kill(transport.pid!, 'SIGKILL')
  await call

  expect(snapshot()).toEqual(before)
  expect(query(dataDir, 'PRAGMA quick_check')).toEqual([{ quick_check: 'ok' }])

  const next = await connect({ dataDir })
  try {
    const result = await next.callTool({ name: 'show_board', arguments: {} })
    expect(result.isError).toBeFalsy()
    expect(query(dataDir, 'SELECT title FROM tasks')).toEqual([{ title: 'Add retries' }])
  } finally {
    await next.close()
  }
}, 60_000)

test('with board.sqlite overwritten by junk, the server starts and every tool refuses with the file named', async () => {
  const junk = Buffer.from('Not a database. '.repeat(512))
  await writeFile(file, junk)

  const client = await connect({ dataDir, clientName: 'claude-ai' })
  try {
    const sentence = `The board's database at ${file} can't be read`
    for (const [name, args] of [
      ['show_board', {}],
      ['add_task', TASK],
      ['get_board', {}],
      ['add_task_from_view', TASK],
    ] as const) {
      const result = await client.callTool({ name, arguments: args })
      expect(result.isError, name).toBe(true)
      expect(textOf(result), name).toBe(sentence)
    }
  } finally {
    await client.close()
  }
  const after = await readFile(file)
  expect(after.equals(junk)).toBe(true)
}, 30_000)
