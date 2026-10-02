import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { runRetention } from '../../../store/retention.js'
import { isWritten } from '../../../store/write.js'
import { buildChild, forkChild } from '../support/child.js'
import { boardRevision } from '../support/store.js'

const CHILD = resolve(import.meta.dirname, '../support/store_child.ts')
const NOW = '2026-10-02T09:00:00.000Z'
const DAY_MS = 24 * 60 * 60 * 1000

let directory: string
let file: string
const opened: Database[] = []

function open() {
  const database = openDatabase(file)
  opened.push(database)
  return database
}

function daysAgo(days: number, from = NOW) {
  return new Date(Date.parse(from) - days * DAY_MS).toISOString()
}

function count(database: Database, table: string) {
  return (database.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n
}

function ids(database: Database, sql: string) {
  return database.sqlite
    .prepare(sql)
    .all()
    .map((row) => row.id)
}

/**
 * A task with one step and one event, inserted as it would be stored.
 */
function insertTask(
  database: Database,
  id: number,
  fields: { status: string; signedOffAt?: string; archivedAt?: string; finishedAt?: string }
) {
  const { sqlite } = database
  sqlite
    .prepare(
      `INSERT INTO tasks (id, title, status, created_by, created_at, finished_at, signed_off_at, archived_at)
       VALUES (?, ?, ?, 'you', ?, ?, ?, ?)`
    )
    .run(
      id,
      `Task ${id}`,
      fields.status,
      daysAgo(60),
      fields.finishedAt ?? fields.signedOffAt ?? null,
      fields.signedOffAt ?? null,
      fields.archivedAt ?? null
    )
  sqlite
    .prepare(
      `INSERT INTO steps (id, task_id, number, owner, title, status, origin)
       VALUES (?, ?, 1, 'agent', 'Do it', ?, 'chain')`
    )
    .run(`step-${id}`, id, fields.status === 'done' ? 'done' : 'pending')
  sqlite
    .prepare(
      `INSERT INTO events (task_id, step_id, session_id, kind, detail, at)
       VALUES (?, ?, 'you', 'added', 'Added', ?)`
    )
    .run(id, `step-${id}`, daysAgo(60))
}

function insertSession(database: Database, id: string, endedAt: string | null) {
  database.sqlite
    .prepare(
      `INSERT INTO sessions (id, kind, name, pid, first_seen_at, last_seen_at, ended_at)
       VALUES (?, 'worker', ?, 1, ?, ?, ?)`
    )
    .run(id, id, daysAgo(30), endedAt ?? NOW, endedAt)
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-retention-'))
  file = join(directory, 'board.sqlite')
})

afterEach(() => {
  for (const database of opened.splice(0)) closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

describe('What retention deletes', () => {
  test('sessions that ended more than 7 days ago go; tasks, live sessions and recent ones stay', () => {
    const database = open()
    insertTask(database, 1, { status: 'done', signedOffAt: daysAgo(31) })
    insertTask(database, 2, { status: 'done', signedOffAt: daysAgo(29) })
    insertTask(database, 3, { status: 'done', finishedAt: daysAgo(90) })
    insertTask(database, 4, { status: 'backlog', archivedAt: daysAgo(90) })
    insertTask(database, 5, { status: 'queue' })
    insertSession(database, 'ended-8-days', daysAgo(8))
    insertSession(database, 'ended-6-days', daysAgo(6))
    insertSession(database, 'live', null)

    const result = runRetention(database, NOW)

    expect(isWritten(result) && result.value).toEqual({ ran: true, sessions: 1 })
    expect(ids(database, 'SELECT id FROM tasks ORDER BY id')).toEqual([1, 2, 3, 4, 5])
    expect(count(database, 'steps')).toBe(5)
    expect(count(database, 'events')).toBe(5)
    expect(ids(database, 'SELECT id FROM sessions ORDER BY id')).toEqual(['ended-6-days', 'live'])
  })

  test('an ended session a task still names is kept', () => {
    const database = open()
    insertSession(database, 'assigned', daysAgo(30))
    insertTask(database, 1, { status: 'done', finishedAt: daysAgo(30) })
    database.sqlite.exec("UPDATE tasks SET assigned_to = 'assigned' WHERE id = 1")

    const result = runRetention(database, NOW)

    expect(isWritten(result) && result.value).toEqual({ ran: true, sessions: 0 })
    expect(ids(database, 'SELECT id FROM sessions')).toEqual(['assigned'])
  })
})

describe('When retention runs', () => {
  test('a deletion bumps the revision once', () => {
    const database = open()
    insertSession(database, 'old-1', daysAgo(10))
    insertSession(database, 'old-2', daysAgo(20))

    const result = runRetention(database, NOW)

    expect(isWritten(result) && result.value.sessions).toBe(2)
    expect(boardRevision(database)).toBe(1)
  })

  test('a run that deletes nothing leaves the revision unchanged', () => {
    const database = open()
    insertSession(database, 'recent', daysAgo(1))

    const result = runRetention(database, NOW)

    expect(isWritten(result) && result.value).toEqual({ ran: true, sessions: 0 })
    expect(boardRevision(database)).toBe(0)
  })

  test('it runs once a day across two opens, and again the next day', () => {
    const first = open()
    expect(isWritten(runRetention(first, NOW))).toBe(true)
    closeDatabase(first)

    const second = open()
    insertSession(second, 'old', daysAgo(10))
    const later = '2026-10-02T23:59:00.000Z'
    const again = runRetention(second, later)
    expect(isWritten(again) && again.value).toEqual({ ran: false, sessions: 0 })
    expect(ids(second, 'SELECT id FROM sessions')).toEqual(['old'])
    expect(boardRevision(second)).toBe(0)

    const nextDay = runRetention(second, '2026-10-03T00:01:00.000Z')
    expect(isWritten(nextDay) && nextDay.value).toEqual({ ran: true, sessions: 1 })
    expect(boardRevision(second)).toBe(1)
  })
})

test('eight processes writing while another runs retention end with a contiguous revision and no busy refusal', async () => {
  const setup = openDatabase(file)
  for (let index = 0; index < 50; index++) insertSession(setup, `old-${index}`, daysAgo(10))
  closeDatabase(setup)

  const script = await buildChild(CHILD)
  const children = [
    ...Array.from({ length: 8 }, () =>
      forkChild<{ ready: true } | { revisions: number[]; busy: number }>(script, [
        'write',
        file,
        '300',
      ])
    ),
    forkChild<{ ready: true } | { revisions: number[]; busy: number }>(script, [
      'retain',
      file,
      NOW,
    ]),
  ]
  await Promise.all(children.map((child) => child.next()))
  for (const child of children) child.process.send('go')
  const results = (await Promise.all(children.map((child) => child.next()))) as Array<{
    revisions: number[]
    busy: number
  }>
  await Promise.all(children.map((child) => child.exited))

  expect(results.map((result) => result.busy)).toEqual(Array(9).fill(0))
  const revisions = results.flatMap((result) => result.revisions).sort((a, b) => a - b)
  expect(revisions).toEqual(Array.from({ length: 2401 }, (_, index) => index + 1))

  const database = open()
  expect(count(database, 'sessions')).toBe(0)
}, 60_000)
