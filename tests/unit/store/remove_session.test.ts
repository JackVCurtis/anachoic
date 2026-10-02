import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { boardViolations, checkBoard } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { Owner } from '../../../domain/types.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { startHeartbeat } from '../../../store/heartbeat.js'
import { readRevision, readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import { loadSession, sessionFromRow } from '../../../store/rows.js'
import {
  addTask,
  askYou,
  blockStep,
  claimStep,
  completeStep,
  type Acted,
  type ServiceResult,
} from '../../../store/services.js'
import {
  listSessions,
  registerLiveness,
  removeSession,
  touchKnownSession,
  touchSession,
} from '../../../store/sessions.js'
import { at } from '../support/domain.js'
import { allTaskStates } from '../support/store.js'

const A = 'session-a'
const B = 'session-b'

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

function touch(id: string, kind: 'worker' | 'dedicated' = 'worker') {
  touchSession(database, { id, kind, projectDir: `/w/${id === A ? 'api-server' : id}` }, now(), 1)
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-remove-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now })
  touch(A)
  touch(B)
  touch('dedicated', 'dedicated')
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function sessions() {
  return read(database, (sqlite) =>
    sqlite.prepare('SELECT * FROM sessions').all().map(sessionFromRow)
  )
}

function check() {
  read(database, (sqlite) =>
    checkBoard(
      allTaskStates(sqlite),
      sqlite.prepare('SELECT * FROM sessions').all().map(sessionFromRow)
    )
  )
}

function ok<T = Acted>(result: ServiceResult<T>): T {
  if (isRefusal(result)) expect.fail(`Refused with ${result.code}: ${result.sentence}`)
  check()
  return result.value
}

function add(owners: Owner[], assignTo?: string): number {
  const steps = owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner }))
  return ok(addTask(database, 'you', now(), { title: 'Task', steps, assignTo })).state.task.id
}

function sessionOf(id: string) {
  return read(database, (sqlite) => loadSession(sqlite, id))!
}

describe('removeSession', () => {
  test('returns a running, a waiting and a blocked step to the queue with the session cleared, with events, in one revision', () => {
    const running = add(['agent'])
    const waiting = add(['agent'])
    const blocked = add(['agent'])
    const assigned = add(['agent', 'agent'], A)
    const handedBack = add(['agent', 'you', 'agent'])
    for (const task of [running, waiting, blocked, handedBack]) {
      ok(claimStep(database, A, now(), task))
    }
    ok(askYou(database, A, now(), waiting, 'Which?'))
    ok(blockStep(database, A, now(), blocked, 'needs AWS credentials'))
    ok(completeStep(database, A, now(), handedBack, { summary: 'Opened the PR' }))
    clock = 30
    const before = readRevision(database)

    const result = ok(removeSession(database, A, now()))

    expect(result).toMatchObject({
      removed: true,
      tasks: [running, waiting, blocked, assigned, handedBack],
    })
    expect(readRevision(database)).toBe(before + 1)
    for (const task of [running, waiting, blocked]) {
      const { state, events } = readTask(database, task)!
      expect(state.task.status).toBe('queue')
      expect(state.steps[0]).toMatchObject({
        status: 'pending',
        claimedBy: null,
        question: null,
        blockedReason: null,
        blockedAt: null,
      })
      expect(events.slice(-2).map((event) => [event.kind, event.detail])).toEqual([
        ['released', 'Released: api-server left the board'],
        ['removed', 'api-server was removed from the board'],
      ])
    }
    expect(readTask(database, assigned)!.state.task.assignedTo).toBeNull()
    expect(
      readTask(database, assigned)!
        .events.slice(-2)
        .map((event) => event.kind)
    ).toEqual(['unassigned', 'removed'])
    expect(readTask(database, handedBack)!.state.task.resumeWith).toBeNull()
    expect(sessionOf(A)).toMatchObject({ endedAt: at(30), removedAt: at(30) })
    expect(
      listSessions(database, now())
        .map(({ session }) => session.id)
        .sort()
    ).toEqual(['dedicated', B])
  })

  test('a removed session is never listed, while one that ended keeps its 10 minutes', () => {
    ok(removeSession(database, A, now()))
    clock = 200
    touch('dedicated', 'dedicated')
    const listed = listSessions(database, now()).map(({ session }) => session.id)
    expect(listed).not.toContain(A)
    expect(listed).toContain(B)
    expect(sessionOf(B).endedAt).toBe(at(200))
  })

  test('refuses the dedicated session and an unknown id, and removing twice changes nothing', () => {
    const before = readRevision(database)
    expect(removeSession(database, 'dedicated', now())).toEqual({
      code: 'invalid',
      sentence: 'This chat cannot be removed',
    })
    expect(removeSession(database, 'nobody', now())).toEqual({
      code: 'not_found',
      sentence: 'Session nobody does not exist',
    })
    expect(readRevision(database)).toBe(before)

    ok(removeSession(database, A, now()))
    const removedAt = sessionOf(A).removedAt
    const after = readRevision(database)
    clock = 50
    const again = ok(removeSession(database, A, now()))
    expect(again).toMatchObject({ removed: false, tasks: [] })
    expect(readRevision(database)).toBe(after)
    expect(sessionOf(A).removedAt).toBe(removedAt)
  })

  test('the heartbeat of a removed session’s process does not revive it; its next tool call does', () => {
    const heartbeat = startHeartbeat(database, { now, intervalMs: 60_000 })
    heartbeat.serve(A)
    try {
      ok(removeSession(database, A, now()))
      clock = 10
      heartbeat.beat()
      expect(sessionOf(A)).toMatchObject({ endedAt: at(0), removedAt: at(0), lastSeenAt: at(10) })
      expect(listSessions(database, now()).map(({ session }) => session.id)).not.toContain(A)

      clock = 20
      const revived = touchKnownSession(database, A, now(), 1)
      expect(isRefusal(revived) ? revived : revived.value.revived).toBe(true)
      expect(sessionOf(A)).toMatchObject({ endedAt: null, removedAt: null })
      expect(listSessions(database, now()).map(({ session }) => session.id)).toContain(A)

      ok(removeSession(database, A, now()))
      touch(A)
      expect(sessionOf(A)).toMatchObject({ endedAt: null, removedAt: null })
    } finally {
      heartbeat.stop()
    }
  })

  test('the invariant: a removed session holds no claim, assignment or resumeWith', () => {
    const task = add(['agent'], A)
    ok(claimStep(database, A, now(), task))
    const states = read(database, allTaskStates)
    const removed = sessions().map((session) =>
      session.id === A ? { ...session, endedAt: now(), removedAt: now() } : session
    )
    expect(boardViolations(states, removed)).toEqual(
      expect.arrayContaining([
        'T-001: removed: assigned to removed session-a',
        'T-001: removed: step 1 claimed by removed session-a',
      ])
    )
  })
})
