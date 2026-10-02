import { mkdtemp, rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, query, textOf } from './support/server.js'

let dataDir: string
let view: Client

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  view = await connect({ dataDir, clientName: 'claude-ai' })
})

afterEach(async () => {
  await view.close()
  await rm(dataDir, { recursive: true, force: true })
})

test('a write from the view while another process holds the write lock past the timeout is refused as busy', async () => {
  await view.callTool({ name: 'get_board', arguments: {} })
  const holder = new DatabaseSync(join(dataDir, 'board.sqlite'))
  holder.exec('BEGIN IMMEDIATE')
  try {
    const result = await view.callTool({
      name: 'add_task_from_view',
      arguments: { title: 'Add retries', steps: [{ title: 'Write it', owner: 'agent' }] },
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('The board is busy. Try again.')
  } finally {
    holder.exec('ROLLBACK')
    holder.close()
  }
  expect(query(dataDir, 'SELECT * FROM tasks')).toEqual([])
}, 30_000)
