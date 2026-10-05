import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { Owner } from '../../../domain/types.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { firstClaimable, readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import { sessionFromRow } from '../../../store/rows.js'
import {
  addTask,
  archiveTask,
  claimStep,
  completeMyStep,
  completeStep,
  moveToBacklog,
  rejectStep,
  type Acted,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { at } from '../support/domain.js'
import { allTaskStates } from '../support/store.js'

const A = 'session-a'
const B = 'session-b'
const DEAD_WINDOW_MS = 120_000

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

function touch(id: string) {
  touchSession(database, { id, kind: 'worker', projectDir: `/w/${id}` }, now(), 1)
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-reject-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now, deadWindowMs: DEAD_WINDOW_MS })
  touch(A)
  touch(B)
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function ok(result: ServiceResult): Acted {
  if (isRefusal(result)) expect.fail(`Refused with ${result.code}: ${result.sentence}`)
  read(database, (sqlite) =>
    checkBoard(
      allTaskStates(sqlite),
      sqlite.prepare('SELECT * FROM sessions').all().map(sessionFromRow)
    )
  )
  return result.value
}

function add(owners: Owner[], assignTo?: string): number {
  const steps = owners.map((owner, index) => ({
    title: index === 1 ? 'Review the PR' : `Step ${index + 1}`,
    owner,
  }))
  return ok(addTask(database, 'you', now(), { title: 'Task', steps, assignTo })).state.task.id
}

function resumeWith(task: number) {
  return readTask(database, task)!.state.task.resumeWith
}

/**
 * A completes step 1 of a task whose step 2 is yours.
 */
function handToYou(owners: Owner[] = ['agent', 'you', 'agent']) {
  const task = add(owners)
  ok(claimStep(database, A, now(), task))
  ok(completeStep(database, A, now(), task, { summary: 'Opened the PR' }))
  return task
}

const NOTE = 'The PR targets the wrong branch'

describe('rejectStep in the store', () => {
  test('reopens the step, queues the task first and hands it back to the worker that did it', () => {
    const other = add(['agent'])
    const task = handToYou()
    const acted = ok(rejectStep(database, 'you', now(), task, NOTE))
    expect(acted.state.task).toMatchObject({ status: 'queue', queuePosition: 1, resumeWith: A })
    expect(acted.state.steps[0]).toMatchObject({ status: 'pending', rejection: NOTE })
    expect(readTask(database, task)!.state.steps[0].rejection).toBe(NOTE)
    expect(readTask(database, other)!.state.task.queuePosition).toBe(2)
    expect(readTask(database, task)!.events.at(-2)).toMatchObject({
      kind: 'rejected',
      detail: NOTE,
      sessionId: 'you',
    })
  })

  test('wait_for_work names the rejected step and the note to that worker only', () => {
    const task = handToYou()
    ok(rejectStep(database, 'you', now(), task, NOTE))
    expect(firstClaimable(database, A)).toEqual({
      taskId: task,
      assigned: false,
      handedBack: true,
      handBack: null,
      rejected: { stepNumber: 1, title: 'Step 1', note: NOTE },
    })
    expect(firstClaimable(database, B)).toBeNull()
  })

  test('rejects the last agent step of a done task', () => {
    const task = add(['agent'])
    ok(claimStep(database, A, now(), task))
    ok(completeStep(database, A, now(), task, { summary: 'Opened the PR' }))
    const acted = ok(rejectStep(database, 'you', now(), task, NOTE))
    expect(acted.state.task).toMatchObject({ status: 'queue', finishedAt: null, resumeWith: A })
  })

  test('prefers no one when the worker that did the step has ended', () => {
    const task = handToYou()
    clock += DEAD_WINDOW_MS / 1000 + 1
    touch(B)
    const acted = ok(rejectStep(database, 'you', now(), task, NOTE))
    expect(acted.state.task.resumeWith).toBeNull()
    expect(firstClaimable(database, B)).toMatchObject({ taskId: task, rejected: null })
  })

  test('refuses an empty note, a session, and a task with nothing to reject', () => {
    const task = handToYou()
    expect(rejectStep(database, 'you', now(), task, '  ')).toEqual({
      code: 'invalid',
      sentence: 'note must be 1 to 2,000 characters',
    })
    expect(rejectStep(database, A, now(), task, NOTE)).toMatchObject({ code: 'not_yours' })
    const queued = add(['agent', 'you'])
    expect(rejectStep(database, 'you', now(), queued, NOTE)).toEqual({
      code: 'wrong_status',
      sentence: `T-00${queued} has no agent output to reject`,
    })
  })
})
