import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard } from '../../../domain/invariants.js'
import { isRefusal, type Refusal } from '../../../domain/refusal.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import { sessionFromRow } from '../../../store/rows.js'
import {
  addTask,
  answerQuestion,
  askYou,
  blockStep,
  checkWaiting,
  claimStep,
  completeStep,
  moveToBacklog,
  unblockStep,
  updateStep,
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
  directory = mkdtempSync(join(tmpdir(), 'anachoic-blocked-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now, deadWindowMs: DEAD_WINDOW_MS })
  touch(A)
  touch(B)
  ok(
    addTask(database, 'you', now(), {
      title: 'Deploy',
      steps: [{ title: 'Deploy', owner: 'agent' }],
    })
  )
  ok(claimStep(database, A, now()))
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

function dump() {
  return read(database, (sqlite) =>
    ['board', 'tasks', 'steps', 'sessions', 'events'].map((table) =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()
    )
  )
}

function refuses(run: () => ServiceResult<unknown>, code: Refusal['code'], sentence: string) {
  const before = dump()
  expect(run()).toEqual({ code, sentence })
  expect(dump()).toEqual(before)
}

function stepRow() {
  return read(database, (sqlite) =>
    sqlite.prepare('SELECT status, blocked_reason, blocked_at FROM steps').get()
  )
}

describe('blockStep and unblockStep', () => {
  test('store the reason and the time, then clear them, with their events', () => {
    clock = 30
    ok(blockStep(database, A, now(), 'T-001', 'needs AWS credentials'))
    expect(stepRow()).toEqual({
      status: 'waiting',
      blocked_reason: 'needs AWS credentials',
      blocked_at: at(30),
    })

    clock = 90
    ok(unblockStep(database, A, now(), 'T-001', 'Done'))
    expect(stepRow()).toEqual({ status: 'running', blocked_reason: null, blocked_at: null })
    expect(readTask(database, 1)!.state.steps[0].waitedSeconds).toBe(60)
    expect(
      readTask(database, 1)!
        .events.slice(-2)
        .map((event) => [event.kind, event.detail])
    ).toEqual([
      ['blocked', 'needs AWS credentials'],
      ['unblocked', 'Done'],
    ])
  })

  test('refusals change no row and leave the revision as it was', () => {
    refuses(
      () => blockStep(database, B, now(), 'T-001', 'mine'),
      'not_yours',
      'Step 1 of T-001 is claimed by session-a'
    )
    refuses(
      () => unblockStep(database, A, now(), 'T-001'),
      'wrong_status',
      'Step 1 of T-001 is not blocked'
    )
    refuses(
      () => blockStep(database, A, now(), 'T-001', ''),
      'invalid',
      'reason must be 1 to 2,000 characters'
    )
    refuses(
      () => blockStep(database, A, now(), 'T-001', 'x'.repeat(2001)),
      'invalid',
      'reason must be 1 to 2,000 characters'
    )

    ok(blockStep(database, A, now(), 'T-001', 'needs AWS credentials'))
    refuses(
      () => blockStep(database, A, now(), 'T-001', 'again'),
      'wrong_status',
      'Step 1 of T-001 is not running'
    )
    refuses(
      () => unblockStep(database, B, now(), 'T-001'),
      'not_yours',
      'Step 1 of T-001 is claimed by session-a'
    )
    refuses(
      () => unblockStep(database, A, now(), 'T-001', 'x'.repeat(501)),
      'invalid',
      'note must be 1 to 500 characters'
    )
    const blocked = 'Step 1 of T-001 is blocked. Call unblock_step first.'
    refuses(
      () => completeStep(database, A, now(), 'T-001', { summary: 'Done' }),
      'wrong_status',
      blocked
    )
    refuses(() => askYou(database, A, now(), 'T-001', 'Which?'), 'wrong_status', blocked)
    refuses(
      () => updateStep(database, A, now(), 'T-001', { note: 'Progress' }),
      'wrong_status',
      blocked
    )
    refuses(
      () => answerQuestion(database, 'you', now(), 'T-001', 'Yes'),
      'wrong_status',
      'Step 1 of T-001 is not waiting for an answer'
    )
    expect(checkWaiting(database, 'T-001', A)).toEqual({ code: 'wrong_status', sentence: blocked })
  })

  test('moving the task to the backlog clears the block', () => {
    ok(blockStep(database, A, now(), 'T-001', 'needs AWS credentials'))
    ok(moveToBacklog(database, 'you', now(), 'T-001'))
    expect(stepRow()).toEqual({ status: 'pending', blocked_reason: null, blocked_at: null })
  })

  test('the end of the blocked session releases the step to the queue and clears the block', () => {
    ok(blockStep(database, A, now(), 'T-001', 'needs AWS credentials'))
    clock += DEAD_WINDOW_MS / 1000 + 1
    touch(B)
    expect(stepRow()).toEqual({ status: 'pending', blocked_reason: null, blocked_at: null })
    expect(readTask(database, 1)!.state.task.status).toBe('queue')
  })
})
