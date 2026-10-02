import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { Owner, StepInput } from '../../../domain/types.js'
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
  directory = mkdtempSync(join(tmpdir(), 'anachoic-resume-'))
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

function add(owners: Owner[], extra: Partial<StepInput> = {}, assignTo?: string): number {
  const steps = owners.map((owner, index) => ({
    title: index === 1 ? 'Review the PR' : `Step ${index + 1}`,
    owner,
    ...(owner === 'you' ? extra : {}),
  }))
  return ok(addTask(database, 'you', now(), { title: 'Task', steps, assignTo })).state.task.id
}

function resumeWith(task: number) {
  return readTask(database, task)!.state.task.resumeWith
}

/**
 * A completes step 1 of a task whose step 2 is yours.
 */
function handToYou(owners: Owner[] = ['agent', 'you', 'agent'], extra: Partial<StepInput> = {}) {
  const task = add(owners, extra)
  ok(claimStep(database, A, now(), task))
  ok(completeStep(database, A, now(), task, { summary: 'Opened the PR' }))
  return task
}

describe('resume_with in the store', () => {
  test('is set when A completes the step before yours, and kept when your step is done', () => {
    const task = handToYou()
    expect(resumeWith(task)).toBe(A)
    ok(completeMyStep(database, 'you', now(), task, { note: 'Looks good' }))
    expect(readTask(database, task)!.state.task.status).toBe('queue')
    expect(resumeWith(task)).toBe(A)
  })

  test.each([
    ['a claim by A', (task: number) => claimStep(database, A, now(), task)],
    ['a claim by B', (task: number) => claimStep(database, B, now(), task)],
    ['moving it to the backlog', (task: number) => moveToBacklog(database, 'you', now(), task)],
    ['archiving it', (task: number) => archiveTask(database, 'you', now(), task)],
  ])('is cleared by %s', (_name, apply) => {
    const task = handToYou()
    ok(completeMyStep(database, 'you', now(), task))
    ok(apply(task))
    expect(resumeWith(task)).toBeNull()
  })

  test('is cleared in the write that ends A, which leaves the task to B', () => {
    const task = handToYou()
    ok(completeMyStep(database, 'you', now(), task))
    expect(firstClaimable(database, B)).toBeNull()

    clock += DEAD_WINDOW_MS / 1000 + 1
    touch(B)

    expect(resumeWith(task)).toBeNull()
    expect(firstClaimable(database, B)).toMatchObject({ taskId: task, handedBack: false })
  })
})

describe('firstClaimable with hand-backs', () => {
  test('prefers a task assigned to the caller, then one handed back to it, then an unassigned one', () => {
    const unassigned = add(['agent'])
    const handedBack = handToYou()
    ok(completeMyStep(database, 'you', now(), handedBack))
    expect(firstClaimable(database, A)).toMatchObject({ taskId: handedBack, handedBack: true })

    const assigned = add(['agent'], {}, A)
    expect(firstClaimable(database, A)).toMatchObject({ taskId: assigned, assigned: true })

    ok(claimStep(database, A, now(), assigned))
    ok(claimStep(database, A, now(), handedBack))
    expect(firstClaimable(database, A)).toMatchObject({ taskId: unassigned, handedBack: false })
  })

  test('wait_for_work leaves a task handed back to another session to it, while claim_step may take it', () => {
    const task = handToYou()
    ok(completeMyStep(database, 'you', now(), task))
    expect(firstClaimable(database, B)).toBeNull()
    expect(ok(claimStep(database, B, now())).state.task.id).toBe(task)
  })

  test('names your step, with its artifact and note', () => {
    const task = handToYou(['agent', 'you', 'agent'], { outputFormat: 'pull_request' })
    ok(
      completeMyStep(database, 'you', now(), task, {
        note: 'Looks good',
        artifactUrl: 'https://github.com/o/r/pull/7',
      })
    )
    expect(firstClaimable(database, A)).toEqual({
      taskId: task,
      assigned: false,
      handedBack: true,
      handBack: {
        stepNumber: 2,
        title: 'Review the PR',
        note: 'Looks good',
        artifactUrl: 'https://github.com/o/r/pull/7',
      },
    })
  })
})
