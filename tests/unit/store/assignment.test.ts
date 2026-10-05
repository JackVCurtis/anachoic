import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard } from '../../../domain/invariants.js'
import { isRefusal, type Refusal } from '../../../domain/refusal.js'
import type { Owner } from '../../../domain/types.js'
import { DatabaseSync } from 'node:sqlite'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { MIGRATIONS } from '../../../store/migrations.js'
import { firstClaimable, readRevision, readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import { sessionFromRow } from '../../../store/rows.js'
import {
  addFollowUp,
  addTask,
  archiveTask,
  claimStep,
  completeStep,
  type Acted,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { write } from '../../../store/write.js'
import { buildChild, forkChild } from '../support/child.js'
import { at } from '../support/domain.js'
import { allTaskStates } from '../support/store.js'

const CHILD = resolve(import.meta.dirname, '../support/store_child.ts')
const A = 'session-a'
const B = 'session-b'
const DEAD_WINDOW_MS = 120_000

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

function touch(id: string, kind: 'worker' | 'dedicated' = 'worker') {
  touchSession(database, { id, kind, projectDir: `/w/${id === A ? 'api-server' : id}` }, now(), 1)
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-assignment-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now, deadWindowMs: DEAD_WINDOW_MS })
  touch(A)
  touch(B)
  touch('dedicated', 'dedicated')
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function allSessions() {
  return read(database, (sqlite) =>
    sqlite.prepare('SELECT * FROM sessions').all().map(sessionFromRow)
  )
}

function checkAll() {
  read(database, (sqlite) =>
    checkBoard(
      allTaskStates(sqlite),
      sqlite.prepare('SELECT * FROM sessions').all().map(sessionFromRow)
    )
  )
}

function ok(result: ServiceResult): Acted {
  if (isRefusal(result)) expect.fail(`Refused with ${result.code}: ${result.sentence}`)
  checkAll()
  return result.value
}

function dump() {
  return read(database, (sqlite) =>
    ['board', 'tasks', 'steps', 'sessions', 'events'].map((table) =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()
    )
  )
}

function refuses(run: () => ServiceResult<unknown>, code: Refusal['code'], sentence: string) {
  const before = dump()
  const result = run()
  expect(isRefusal(result), JSON.stringify(result)).toBe(true)
  expect(result).toEqual({ code, sentence })
  expect(dump()).toEqual(before)
}

function add(assignTo: string | null, owners: Owner[] = ['agent'], queue = true) {
  return ok(
    addTask(database, 'you', now(), {
      title: 'Add retries',
      steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
      queue,
      assignTo,
    })
  ).state.task.id
}

function eventsOf(taskId: number) {
  return readTask(database, taskId)!.events.map((event) => [event.kind, event.detail])
}

function claimedTask(result: ServiceResult) {
  return ok(result).state.task.id
}

describe('Add and Add to queue with a worker', () => {
  test('assigns a live worker and records an assigned event', () => {
    const queued = add(A)
    const backlog = add(B, ['agent'], false)
    expect(readTask(database, queued)!.state.task).toMatchObject({
      status: 'queue',
      assignedTo: A,
    })
    expect(readTask(database, backlog)!.state.task).toMatchObject({
      status: 'backlog',
      assignedTo: B,
    })
    expect(eventsOf(queued)).toEqual([
      ['added', 'Added with 1 step'],
      ['assigned', 'Assigned to api-server'],
      ['queued', 'Joined the back of the queue'],
    ])
  })

  test('refuses the dedicated session, an ended worker and an unknown session, changing nothing', () => {
    const assign = (assignTo: string) => () =>
      addTask(database, 'you', now(), {
        title: 'Add retries',
        steps: [{ title: 'Do', owner: 'agent' }],
        assignTo,
      })
    refuses(assign('dedicated'), 'invalid', 'This chat is not a live worker')
    refuses(assign('nobody'), 'invalid', 'nobody is not a live worker')

    clock = 200
    touch(A)
    expect(allSessions().find((session) => session.id === B)).toMatchObject({ endedAt: at(200) })
    refuses(assign(B), 'invalid', 'session-b is not a live worker')
  })
})

describe('Claim of an assigned task', () => {
  test('is refused to another worker and to the dedicated session, changing nothing', () => {
    const id = add(A)
    refuses(
      () => claimStep(database, B, now(), id),
      'not_yours',
      `T-00${id} is assigned to api-server`
    )
    refuses(
      () => claimStep(database, 'dedicated', now(), id),
      'not_yours',
      `T-00${id} is assigned to api-server`
    )
    expect(claimedTask(claimStep(database, A, now(), id))).toBe(id)
  })
})

describe('claimStep with no task', () => {
  test('takes the caller’s assigned tasks first, then unassigned ones, never another’s', () => {
    const unassigned = add(null)
    const forB = add(B)
    const forA = add(A)
    expect(claimedTask(claimStep(database, A, now()))).toBe(forA)
    expect(claimedTask(claimStep(database, A, now()))).toBe(unassigned)
    refuses(
      () => claimStep(database, A, now()),
      'nothing_to_claim',
      'Nothing in the queue needs an agent'
    )
    expect(claimedTask(claimStep(database, B, now()))).toBe(forB)
  })

  test('skips a task assigned to another at the front of the queue', () => {
    add(B)
    const second = add(null)
    expect(claimedTask(claimStep(database, 'dedicated', now()))).toBe(second)
  })

  test('takes the assigned task by queue position, behind other work', () => {
    add(null)
    const later = add(A)
    const latest = add(A)
    expect(readTask(database, later)!.state.task.queuePosition).toBe(2)
    expect(claimedTask(claimStep(database, A, now()))).toBe(later)
    expect(claimedTask(claimStep(database, A, now()))).toBe(latest)
  })
})

describe('firstClaimable', () => {
  test('prefers assigned over unassigned, never returns another’s, and is a read only', () => {
    const unassigned = add(null)
    const forB = add(B)
    const revision = readRevision(database)
    expect(firstClaimable(database, A)).toEqual({
      taskId: unassigned,
      assigned: false,
      handedBack: false,
      handBack: null,
      rejected: null,
    })
    expect(firstClaimable(database, B)).toEqual({
      taskId: forB,
      assigned: true,
      handedBack: false,
      handBack: null,
      rejected: null,
    })
    ok(claimStep(database, A, now()))
    const afterClaim = readRevision(database)
    expect(firstClaimable(database, A)).toBeNull()
    expect(firstClaimable(database, 'dedicated')).toBeNull()
    const forA = add(A)
    add(null)
    expect(firstClaimable(database, A)).toEqual({
      taskId: forA,
      assigned: true,
      handedBack: false,
      handBack: null,
      rejected: null,
    })
    expect(readRevision(database)).toBe(afterClaim + 2)
    expect(revision).toBeLessThan(afterClaim)
  })

  test("ignores tasks in the backlog and tasks whose current step is the user's", () => {
    add(A, ['agent'], false)
    add(A, ['you', 'agent'])
    expect(firstClaimable(database, A)).toBeNull()
  })
})

describe('Release of a dead worker', () => {
  test('clears its assignments in the same write as releasing its claims, with one unassigned event each', () => {
    const claimed = add(A)
    const waiting = add(A)
    const done = add(A)
    const other = add(B)
    ok(claimStep(database, A, now(), done))
    ok(completeStep(database, A, now(), done, { summary: 'Did it' }))
    ok(claimStep(database, A, now(), claimed))
    clock = 100
    touch(B)
    const revision = readRevision(database)

    clock = 200
    touch(B)
    expect(readRevision(database)).toBe(revision + 1)
    checkAll()
    for (const id of [claimed, waiting, done]) {
      expect(readTask(database, id)!.state.task.assignedTo).toBeNull()
      expect(eventsOf(id).at(-1)).toEqual([
        'unassigned',
        'Unassigned: api-server stopped responding',
      ])
    }
    expect(
      eventsOf(claimed)
        .slice(-2)
        .map(([kind]) => kind)
    ).toEqual(['released', 'unassigned'])
    expect(readTask(database, claimed)!.state.task).toMatchObject({
      status: 'queue',
      queuePosition: 1,
    })
    expect(readTask(database, other)!.state.task.assignedTo).toBe(B)
    expect(eventsOf(other).map(([kind]) => kind)).not.toContain('unassigned')

    expect(claimedTask(claimStep(database, B, now()))).toBe(other)
    expect(claimedTask(claimStep(database, B, now()))).toBe(claimed)
  })

  test('a worker revived after it ended does not get its assignments back', () => {
    const id = add(A)
    clock = 200
    touch(B)
    touch(A)
    expect(readTask(database, id)!.state.task.assignedTo).toBeNull()
    checkAll()
  })
})

describe('Archive and follow-up', () => {
  test('archive clears the assignment and a follow-up keeps it', () => {
    const archived = add(A)
    ok(archiveTask(database, 'you', now(), archived))
    expect(readTask(database, archived)!.state.task.assignedTo).toBeNull()

    const id = add(A)
    ok(claimStep(database, A, now(), id))
    ok(completeStep(database, A, now(), id, { summary: 'Did it' }))
    ok(
      addFollowUp(database, 'you', now(), id, {
        steps: [{ title: 'More', owner: 'agent' }],
        placement: 'first',
      })
    )
    expect(readTask(database, id)!.state.task).toMatchObject({ status: 'queue', assignedTo: A })
    refuses(
      () => claimStep(database, B, now(), id),
      'not_yours',
      `T-00${id} is assigned to api-server`
    )
  })
})

describe('The assignment migration', () => {
  test('keeps the events of a database at version 1 and accepts the new kinds', () => {
    const file = join(directory, 'old.sqlite')
    const raw = new DatabaseSync(file)
    raw.exec(MIGRATIONS[0])
    raw.exec('PRAGMA user_version = 1')
    raw.exec(
      `INSERT INTO tasks (id, title, status, created_by, created_at) VALUES (1, 'Old', 'backlog', 'you', 'x');
       INSERT INTO events (id, task_id, session_id, kind, detail, at) VALUES (7, 1, 'you', 'added', 'Added', 'x');`
    )
    raw.close()

    const migrated = openDatabase(file)
    try {
      expect(migrated.sqlite.prepare('SELECT id, kind FROM events').all()).toEqual([
        { id: 7, kind: 'added' },
      ])
      expect(migrated.sqlite.prepare('SELECT assigned_to FROM tasks').get()).toEqual({
        assigned_to: null,
      })
      migrated.sqlite
        .prepare(
          "INSERT INTO events (task_id, session_id, kind, detail, at) VALUES (1, 'you', 'unassigned', 'x', 'x')"
        )
        .run()
    } finally {
      closeDatabase(migrated)
    }
  })
})

describe('Several processes', () => {
  test('a killed worker process’s assigned tasks become unassigned within the dead window, observed from another process', async () => {
    const deadWindowMs = 400
    const script = await buildChild(CHILD)
    const child = forkChild<{ ready: true } | { taskIds: number[] }>(script, [
      'serve assigned',
      database.file,
      'killed',
      '50',
      String(deadWindowMs),
    ])
    await child.next()
    child.process.send('go')
    const { taskIds } = (await child.next()) as { taskIds: number[] }
    const assignedTo = () => taskIds.map((id) => readTask(database, id)!.state.task.assignedTo)
    expect(assignedTo()).toEqual(['killed', 'killed'])

    child.process.kill('SIGKILL')
    await child.exited
    const killedAt = Date.now()

    const observer = openDatabase(database.file)
    registerLiveness(observer, { now: () => new Date().toISOString(), deadWindowMs })
    try {
      let unassigned = false
      while (!unassigned && Date.now() - killedAt < deadWindowMs * 3) {
        write(observer, () => null)
        unassigned = assignedTo().every((id) => id === null)
        if (!unassigned) await sleep(25)
      }
    } finally {
      closeDatabase(observer)
    }
    expect(Date.now() - killedAt).toBeLessThan(deadWindowMs + 200)
    expect(assignedTo()).toEqual([null, null])
    expect(readTask(database, taskIds[0])!.state.steps[0]).toMatchObject({
      status: 'pending',
      claimedBy: null,
    })
    for (const id of taskIds) expect(eventsOf(id).at(-1)?.[0]).toBe('unassigned')
    checkAll()
  }, 30_000)
})
