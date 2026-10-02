import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard } from '../../../domain/invariants.js'
import { ask, claim } from '../../../domain/transitions.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { startHeartbeat, type Heartbeat } from '../../../store/heartbeat.js'
import { read } from '../../../store/read.js'
import { loadTaskState } from '../../../store/rows.js'
import {
  defaultName,
  listSessions,
  registerLiveness,
  setSessionName,
  touchSession,
  type Identity,
} from '../../../store/sessions.js'
import { isWritten, write } from '../../../store/write.js'
import { at } from '../support/domain.js'
import { buildChild, forkChild } from '../support/child.js'
import { addQueuedTask, allTaskStates, boardRevision, transition } from '../support/store.js'

const CHILD = resolve(import.meta.dirname, '../support/store_child.ts')
const DEAD_WINDOW_MS = 120_000

let directory: string
let database: Database
let clock: number
const heartbeats: Heartbeat[] = []

const now = () => at(clock)

const WORKER: Identity = {
  id: 'session-a',
  kind: 'worker',
  projectDir: '/Users/jack/code/api-server',
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-sessions-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
})

afterEach(() => {
  for (const heartbeat of heartbeats.splice(0)) heartbeat.stop()
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function touch(identity: Identity = WORKER, pid = 100) {
  const result = touchSession(database, identity, now(), pid)
  if (!isWritten(result)) throw new Error(result.sentence)
  return result
}

function session(id: string) {
  return read(database, (sqlite) => sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(id))
}

function noop() {
  const result = write(database, () => null)
  if (!isWritten(result)) throw new Error(result.sentence)
}

describe('Identity rows', () => {
  test.each([
    [{ id: 'dedicated', kind: 'dedicated', projectDir: null }, 'This chat'],
    [WORKER, 'api-server'],
    [{ id: 'w', kind: 'worker', projectDir: '/Users/jack/code/web-client/' }, 'web-client'],
    [{ id: 'w', kind: 'worker', projectDir: null }, 'Session'],
    [{ id: 'w', kind: 'worker', projectDir: '/' }, 'Session'],
  ] as Array<[Identity, string]>)('%j is named %s by default', (identity, name) => {
    expect(defaultName(identity)).toBe(name)
  })

  test('a first touch creates the row and moves the revision; a second refreshes it without', () => {
    const first = touch()
    expect(first.revision).toBe(1)
    expect(session('session-a')).toMatchObject({
      name: 'api-server',
      kind: 'worker',
      project_dir: '/Users/jack/code/api-server',
      pid: 100,
      first_seen_at: at(0),
      last_seen_at: at(0),
      ended_at: null,
    })
    clock = 30
    const second = touch(WORKER, 200)
    expect(second.revision).toBe(1)
    expect(second.value).toMatchObject({ created: false, revived: false })
    expect(session('session-a')).toMatchObject({
      pid: 200,
      first_seen_at: at(0),
      last_seen_at: at(30),
    })
  })

  test('a touch after the session ended clears endedAt, and the released step stays pending in the queue', () => {
    registerLiveness(database, { now, deadWindowMs: DEAD_WINDOW_MS })
    touch()
    const taskId = addQueuedTask(database, ['agent'], { actor: 'session-a', now: now() })
    transition(database, taskId, (state) => claim(state, { actor: 'session-a', now: now() }))
    clock = 121
    noop()
    expect(session('session-a')).toMatchObject({ ended_at: at(121) })

    clock = 130
    expect(touch().value).toMatchObject({ revived: true })
    expect(session('session-a')).toMatchObject({ ended_at: null, last_seen_at: at(130) })
    const state = read(database, (sqlite) => loadTaskState(sqlite, taskId))!
    expect(state.task).toMatchObject({ status: 'queue', queuePosition: 1 })
    expect(state.steps[0]).toMatchObject({ status: 'pending', claimedBy: null })
  })

  test('setSessionName sets the name within its limit', () => {
    touch()
    expect(setSessionName(database, 'session-a', 'payments')).toMatchObject({
      value: { id: 'session-a', kind: 'worker', name: 'payments' },
    })
    expect(setSessionName(database, 'session-a', '')).toMatchObject({ code: 'invalid' })
    expect(setSessionName(database, 'session-a', 'x'.repeat(41))).toMatchObject({ code: 'invalid' })
    expect(setSessionName(database, 'nobody', 'x')).toMatchObject({ code: 'not_found' })
    expect(session('session-a')).toMatchObject({ name: 'payments' })
  })
})

describe('Liveness', () => {
  test('a write after the dead window ends a silent session and releases its step to the front of the queue', () => {
    registerLiveness(database, { now, deadWindowMs: 1000 })
    touch()
    const older = addQueuedTask(database, ['agent'], { actor: 'you', now: now() })
    const taskId = addQueuedTask(database, ['agent', 'you'], { actor: 'you', now: now() })
    transition(database, taskId, (state) => claim(state, { actor: 'session-a', now: now() }))
    transition(database, taskId, (state) =>
      ask(state, { actor: 'session-a', now: now() }, 'Which?')
    )

    clock = 1
    noop()
    expect(session('session-a')).toMatchObject({ ended_at: null })

    clock = 2
    noop()
    expect(session('session-a')).toMatchObject({ ended_at: at(2) })
    read(database, (sqlite) => {
      const state = loadTaskState(sqlite, taskId)!
      expect(state.task).toMatchObject({ status: 'queue', queuePosition: 1 })
      expect(state.steps[0]).toMatchObject({ status: 'pending', claimedBy: null, question: null })
      expect(loadTaskState(sqlite, older)!.task.queuePosition).toBe(2)
      expect(
        sqlite.prepare("SELECT session_id, step_id FROM events WHERE kind = 'released'").all()
      ).toEqual([{ session_id: 'session-a', step_id: `${taskId}.1` }])
      checkBoard(allTaskStates(sqlite))
    })
  })

  test('a session whose heartbeat keeps running is never ended, and a plain heartbeat keeps the revision', () => {
    const heartbeat = startHeartbeat(database, { now, deadWindowMs: 1000, intervalMs: 60_000 })
    heartbeats.push(heartbeat)
    heartbeat.serve('session-a')
    touch()
    const revision = boardRevision(database)
    for (clock = 0; clock < 10; clock += 0.5) heartbeat.beat()
    expect(boardRevision(database)).toBe(revision)
    expect(session('session-a')).toMatchObject({ ended_at: null, last_seen_at: at(9.5) })
  })

  test('another process’s write never ends a session whose heartbeat keeps beating', () => {
    const heartbeat = startHeartbeat(database, { now, deadWindowMs: 1000, intervalMs: 60_000 })
    heartbeats.push(heartbeat)
    heartbeat.serve('session-a')
    touch()
    const other = openDatabase(database.file)
    registerLiveness(other, { now, deadWindowMs: 1000 })
    try {
      for (clock = 0; clock < 10; clock += 0.5) {
        heartbeat.beat()
        write(other, () => null)
      }
    } finally {
      closeDatabase(other)
    }
    expect(session('session-a')).toMatchObject({ ended_at: null })
  })

  test('a plain heartbeat that ends a dead session moves the revision', () => {
    const heartbeat = startHeartbeat(database, { now, deadWindowMs: 1000, intervalMs: 60_000 })
    heartbeats.push(heartbeat)
    heartbeat.serve('session-b')
    touch()
    touch({ id: 'session-b', kind: 'worker', projectDir: null })
    const revision = boardRevision(database)
    clock = 2
    heartbeat.beat()
    expect(boardRevision(database)).toBe(revision + 1)
    expect(session('session-a')).toMatchObject({ ended_at: at(2) })
    expect(session('session-b')).toMatchObject({ ended_at: null })
  })

  test('listSessions shows live sessions and those ended in the last 10 minutes with what they released', () => {
    registerLiveness(database, { now, deadWindowMs: DEAD_WINDOW_MS })
    touch()
    touch({ id: 'session-b', kind: 'worker', projectDir: '/w/docs' })
    const taskId = addQueuedTask(database, ['agent'], { actor: 'you', now: now() })
    transition(database, taskId, (state) => claim(state, { actor: 'session-b', now: now() }))
    clock = 100
    touch()
    clock = 200
    touch()
    expect(session('session-b')).toMatchObject({ ended_at: at(200) })

    clock = 200 + 9 * 60
    touch()
    const listed = listSessions(database, now())
    expect(listed.map((each) => [each.session.id, each.live, each.released])).toEqual([
      ['session-a', true, []],
      ['session-b', false, [{ id: taskId, title: `Task ${taskId}` }]],
    ])

    clock = 200 + 10 * 60 + 1
    expect(listSessions(database, now()).map((each) => each.session.id)).toEqual(['session-a'])
  })
})

describe('Several processes', () => {
  test('a process killed with SIGKILL has its claim released by another process’s write within the dead window', async () => {
    const deadWindowMs = 400
    const script = await buildChild(CHILD)
    const child = forkChild<{ ready: true } | { taskId: number }>(script, [
      'serve',
      database.file,
      'killed',
      '50',
      String(deadWindowMs),
    ])
    await child.next()
    child.process.send('go')
    const { taskId } = (await child.next()) as { taskId: number }

    const claimed = read(database, (sqlite) => loadTaskState(sqlite, taskId))!
    expect(claimed.steps[0]).toMatchObject({ status: 'running', claimedBy: 'killed' })

    await sleep(deadWindowMs * 2)
    const live = read(database, (sqlite) => loadTaskState(sqlite, taskId))!
    expect(live.steps[0].status).toBe('running')

    child.process.kill('SIGKILL')
    await child.exited
    const killedAt = Date.now()

    registerLiveness(database, { now: () => new Date().toISOString(), deadWindowMs })
    let released = false
    while (!released && Date.now() - killedAt < deadWindowMs * 3) {
      write(database, () => null)
      released =
        read(database, (sqlite) => loadTaskState(sqlite, taskId))!.steps[0].status === 'pending'
      if (!released) await sleep(25)
    }
    expect(Date.now() - killedAt).toBeLessThan(deadWindowMs + 200)
    const state = read(database, (sqlite) => loadTaskState(sqlite, taskId))!
    expect(state.task).toMatchObject({ status: 'queue', queuePosition: 1 })
    expect(state.steps[0]).toMatchObject({ status: 'pending', claimedBy: null })
    expect(session('killed')).toMatchObject({ ended_at: expect.any(String) })
  }, 30_000)
})
