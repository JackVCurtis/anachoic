import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { viewUris } from '../../server/views.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'anachoic-views-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function hashOf(html: string) {
  return createHash('sha256').update(html).digest('hex').slice(0, 12)
}

test('each address carries the first 12 hex digits of a SHA-256 of its HTML', async () => {
  await writeFile(join(directory, 'board.html'), '<!doctype html><p>board</p>')
  await writeFile(join(directory, 'task.html'), '<!doctype html><p>task</p>')

  expect(viewUris(directory)).toEqual({
    board: `ui://anachoic/board-${hashOf('<!doctype html><p>board</p>')}.html`,
    task: `ui://anachoic/task-${hashOf('<!doctype html><p>task</p>')}.html`,
  })
})

test('a rebuilt view gets a new address, and an unchanged one keeps its address', async () => {
  await writeFile(join(directory, 'board.html'), 'one')
  await writeFile(join(directory, 'task.html'), 'same')
  const before = viewUris(directory)

  await writeFile(join(directory, 'board.html'), 'two')
  const after = viewUris(directory)

  expect(after.board).not.toBe(before.board)
  expect(after.task).toBe(before.task)
})

test('a view whose file cannot be read keeps its plain address', () => {
  expect(viewUris(directory)).toEqual({
    board: 'ui://anachoic/board.html',
    task: 'ui://anachoic/task.html',
  })
})
