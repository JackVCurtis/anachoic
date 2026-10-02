import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createCallers } from '../../server/callers.js'
import type { Logger } from '../../server/logger.js'
import { closeDatabase, openDatabase, type Database } from '../../store/database.js'
import { listSessions } from '../../store/sessions.js'
import { at } from './support/domain.js'

let directory: string
let database: Database
let served: string[]
let logged: Array<{ event: string; sessionId?: string; fields?: unknown }>
let minted: number

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-callers-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  served = []
  logged = []
  minted = 0
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function callers(env = {}) {
  let sessionId: string | undefined
  const logger: Logger = {
    log: (event, fields) => logged.push({ event, sessionId, fields }),
    setSessionId: (id) => void (sessionId = id),
  }
  return createCallers({
    database,
    heartbeat: { serve: (id) => void served.push(id) },
    env,
    logger,
    now: () => at(0),
    pid: 42,
    mint: () => `minted-${++minted}`,
  })
}

describe('createCallers', () => {
  test('a worker is touched and served by the heartbeat, and logged once', () => {
    const resolve = callers({ CLAUDE_CODE_SESSION_ID: 'e261', CLAUDE_PROJECT_DIR: '/w/api' })

    expect(resolve.enter({ name: 'claude-code' })).toEqual({
      id: 'e261',
      kind: 'worker',
      name: 'api',
      minted: false,
    })
    resolve.enter({ name: 'claude-code' })

    expect(served).toEqual(['e261', 'e261'])
    expect(logged).toEqual([
      {
        event: 'session',
        sessionId: 'e261',
        fields: { id: 'e261', kind: 'worker', source: 'client' },
      },
    ])
    expect(listSessions(database, at(0)).map(({ session }) => session.id)).toEqual(['e261'])
  })

  test('an unknown client mints one id on its first call and keeps it', () => {
    const resolve = callers()

    expect(resolve.enter({ name: 'basic-host' })).toMatchObject({ id: 'minted-1', minted: true })
    expect(resolve.enter({ name: 'basic-host' })).toMatchObject({ id: 'minted-1', minted: true })
    expect(minted).toBe(1)
  })

  test('a first call that names a known session makes it the process’s session', () => {
    callers().enter(undefined)
    const other = callers()

    expect(other.enter(undefined, 'minted-1')).toMatchObject({ id: 'minted-1', minted: true })
    expect(other.enter(undefined)).toMatchObject({ id: 'minted-1' })
    expect(minted).toBe(1)
  })

  test('a session the board has never seen is refused with not_found and nothing is served', () => {
    expect(callers().enter(undefined, 'made-up')).toMatchObject({ code: 'not_found' })
    expect(served).toEqual([])
    expect(listSessions(database, at(0))).toEqual([])
  })
})
