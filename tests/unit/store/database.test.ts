import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  closeDatabase,
  DatabaseTooNewError,
  DatabaseUnreadableError,
  latestVersion,
  openDatabase,
  type Database,
} from '../../../store/database.js'
import { read } from '../../../store/read.js'
import { isWritten, write } from '../../../store/write.js'
import { buildChild, forkChild } from '../support/child.js'

const CHILD = resolve(import.meta.dirname, '../support/store_child.ts')

let directory: string
let file: string
const opened: Database[] = []

function open(options?: Parameters<typeof openDatabase>[1]) {
  const database = openDatabase(file, options)
  opened.push(database)
  return database
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-store-'))
  file = join(directory, 'board.sqlite')
})

afterEach(() => {
  for (const database of opened.splice(0)) closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function revision(database: Database) {
  return read(
    database,
    (sqlite) =>
      (sqlite.prepare('SELECT revision FROM board').get() as { revision: number }).revision
  )
}

describe('Opening', () => {
  test('a fresh file is migrated to the latest version with every table and the board row', () => {
    const database = open()
    expect(database.applied).toBe(latestVersion())
    const { sqlite } = database
    expect(
      (sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
    ).toBe(latestVersion())
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name)
    expect(tables).toEqual(['board', 'events', 'sessions', 'steps', 'tasks'])
    expect(sqlite.prepare('SELECT * FROM board').all()).toEqual([
      { id: 1, revision: 0, next_task_number: 1, retained_on: null },
    ])
  })

  test('sets the pragmas', () => {
    const { sqlite } = open()
    const pragma = (name: string) => Object.values(sqlite.prepare(`PRAGMA ${name}`).get()!)[0]
    expect(pragma('journal_mode')).toBe('wal')
    expect(pragma('busy_timeout')).toBe(5000)
    expect(pragma('synchronous')).toBe(1)
    expect(pragma('foreign_keys')).toBe(1)
  })

  test('opening it again applies nothing', () => {
    closeDatabase(open())
    const again = open()
    expect(again.applied).toBe(0)
    expect(again.sqlite.prepare('SELECT count(*) AS n FROM board').get()).toEqual({ n: 1 })
  })

  test('a database whose user_version is ahead refuses to open', () => {
    const raw = new DatabaseSync(file)
    raw.exec(`PRAGMA user_version = ${latestVersion() + 1}`)
    raw.close()
    expect(() => openDatabase(file)).toThrow(DatabaseTooNewError)
    expect(() => openDatabase(file)).toThrow(/A newer version of the server owns the database/)
  })

  test('a file that is not a database is unreadable, and is left byte for byte', () => {
    const junk = Buffer.from('This is not a database, only some text in its place.\n'.repeat(200))
    writeFileSync(file, junk)
    expect(() => openDatabase(file)).toThrow(DatabaseUnreadableError)
    expect(() => openDatabase(file)).toThrow(`The board's database at ${file} can't be read`)
    expect(readFileSync(file).equals(junk)).toBe(true)
  })

  test('a file that fails its quick_check is unreadable', () => {
    const database = open()
    database.sqlite.exec('CREATE TABLE filler (text TEXT)')
    const insert = database.sqlite.prepare('INSERT INTO filler VALUES (?)')
    for (let index = 0; index < 2000; index++) insert.run(`row ${index} `.repeat(20))
    database.sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    closeDatabase(database)
    const bytes = readFileSync(file)
    const pageSize = bytes.readUInt16BE(16)
    for (let page = 2; page < bytes.length / pageSize; page += 3) {
      bytes.fill(0xa5, page * pageSize, page * pageSize + 64)
    }
    writeFileSync(file, bytes)
    expect(() => openDatabase(file)).toThrow(DatabaseUnreadableError)
    expect(readFileSync(file).equals(bytes)).toBe(true)
  })

  test('the constraints refuse a second board row and an unknown status', () => {
    const { sqlite } = open()
    expect(() =>
      sqlite.exec('INSERT INTO board (id, revision, next_task_number) VALUES (2, 0, 1)')
    ).toThrow()
    expect(() =>
      sqlite.exec(
        "INSERT INTO tasks (id, title, status, created_by, created_at) VALUES (1, 'x', 'lost', 'you', 'now')"
      )
    ).toThrow()
  })

  test('queue positions are unique', () => {
    const { sqlite } = open()
    sqlite.exec(
      "INSERT INTO tasks (id, title, status, queue_position, created_by, created_at) VALUES (1, 'a', 'queue', 1, 'you', 'now')"
    )
    expect(() =>
      sqlite.exec(
        "INSERT INTO tasks (id, title, status, queue_position, created_by, created_at) VALUES (2, 'b', 'queue', 1, 'you', 'now')"
      )
    ).toThrow(/UNIQUE/)
  })
})

describe('Writing', () => {
  test('a write runs its change, bumps the revision and returns both', () => {
    const database = open()
    const result = write(database, (sqlite) => {
      sqlite.exec(
        "INSERT INTO sessions (id, kind, name, pid, first_seen_at, last_seen_at) VALUES ('s', 'worker', 'api', 1, 'now', 'now')"
      )
      return 'done'
    })
    expect(result).toEqual({ value: 'done', revision: 1 })
    expect(revision(database)).toBe(1)
  })

  test('a change that throws leaves the revision and every row unchanged', () => {
    const database = open()
    expect(() =>
      write(database, (sqlite) => {
        sqlite.exec(
          "INSERT INTO sessions (id, kind, name, pid, first_seen_at, last_seen_at) VALUES ('s', 'worker', 'api', 1, 'now', 'now')"
        )
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(revision(database)).toBe(0)
    expect(database.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 })
    expect(database.sqlite.isTransaction).toBe(false)
  })

  test('a change that returns a refusal is rolled back and the refusal returned', () => {
    const database = open()
    const refusal = { code: 'invalid' as const, sentence: 'No' }
    const result = write(database, (sqlite) => {
      sqlite.exec(
        "INSERT INTO sessions (id, kind, name, pid, first_seen_at, last_seen_at) VALUES ('s', 'worker', 'api', 1, 'now', 'now')"
      )
      return refusal
    })
    expect(result).toEqual(refusal)
    expect(revision(database)).toBe(0)
    expect(database.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 })
  })

  test('a change that returns a promise is refused and rolled back', () => {
    const database = open()
    expect(() =>
      write(database, async (sqlite) => {
        sqlite.exec(
          "INSERT INTO sessions (id, kind, name, pid, first_seen_at, last_seen_at) VALUES ('s', 'worker', 'api', 1, 'now', 'now')"
        )
      })
    ).toThrow(TypeError)
    expect(revision(database)).toBe(0)
    expect(database.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 })
  })

  test('keepRevision leaves the revision unless a hook changed the board', () => {
    let changed = false
    const database = open({ writeHooks: [() => changed] })
    expect(write(database, () => null, { keepRevision: true })).toEqual({
      value: null,
      revision: 0,
    })
    changed = true
    expect(write(database, () => null, { keepRevision: true })).toEqual({
      value: null,
      revision: 1,
    })
  })

  test('hooks run inside the transaction, before the change', () => {
    const order: string[] = []
    const database = open({
      writeHooks: [
        (sqlite) => {
          order.push(`hook ${sqlite.isTransaction}`)
          return false
        },
      ],
    })
    write(database, () => order.push('change'))
    expect(order).toEqual(['hook true', 'change'])
  })

  test('a second connection holding the write lock past the busy timeout makes write return busy', () => {
    closeDatabase(open())
    const holder = open()
    const waiter = open({ busyTimeoutMs: 50 })
    holder.sqlite.exec('BEGIN IMMEDIATE')
    try {
      const result = write(waiter, () => 'never')
      expect(result).toEqual({ code: 'busy', sentence: 'The board is busy. Try again.' })
      expect(waiter.sqlite.isTransaction).toBe(false)
    } finally {
      holder.sqlite.exec('ROLLBACK')
    }
    expect(revision(waiter)).toBe(0)
  })
})

describe('Reading', () => {
  test('a read sees one snapshot and never takes the write lock', () => {
    const writer = open()
    const reader = open()
    writer.sqlite.exec('BEGIN IMMEDIATE')
    try {
      expect(revision(reader)).toBe(0)
    } finally {
      writer.sqlite.exec('ROLLBACK')
    }
  })
})

describe('Several processes', () => {
  async function startTogether<Message>(count: number, args: string[]) {
    const script = await buildChild(CHILD)
    const children = Array.from({ length: count }, () =>
      forkChild<Message | { ready: true }>(script, args)
    )
    await Promise.all(children.map((child) => child.next()))
    for (const child of children) child.process.send('go')
    const results = await Promise.all(
      children.map((child) =>
        Promise.race([
          child.next() as Promise<Message>,
          child.exited.then(() => {
            throw new Error('The child exited without a result')
          }),
        ])
      )
    )
    await Promise.all(children.map((child) => child.exited))
    return results
  }

  test('eight processes making 500 writes each never get busy, and the revisions run 1 to 4000', async () => {
    closeDatabase(openDatabase(file))
    const results = await startTogether<{ revisions: number[]; busy: number }>(8, [
      'write',
      file,
      '500',
    ])
    expect(results.map((result) => result.busy)).toEqual(Array(8).fill(0))
    const revisions = results.flatMap((result) => result.revisions).sort((a, b) => a - b)
    expect(revisions).toEqual(Array.from({ length: 4000 }, (_, index) => index + 1))
  }, 60_000)

  test('processes opening a fresh file together all succeed, and the migration runs once', async () => {
    const results = await startTogether<{ applied: number }>(8, ['open', file])
    expect(results.map((result) => result.applied).sort()).toEqual([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      latestVersion(),
    ])
  }, 60_000)
})

test('isWritten tells a result from a refusal', () => {
  expect(isWritten({ value: 1, revision: 1 })).toBe(true)
  expect(isWritten({ code: 'busy', sentence: 'x' })).toBe(false)
})
