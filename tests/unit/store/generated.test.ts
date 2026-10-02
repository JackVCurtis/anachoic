import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { boardViolations } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { Actor, Owner } from '../../../domain/types.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readRevision } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import * as services from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { at } from '../support/domain.js'
import { allTaskStates } from '../support/store.js'

const SESSIONS = ['session-a', 'session-b', 'session-c']
const ACTORS: Actor[] = ['you', ...SESSIONS]
const OPERATIONS = 400

/**
 * Mulberry32: a small seeded generator, so a failing run can be repeated.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Every operation that succeeded in some seed, to show the runs reach them all.
 */
const succeeded = new Set<string>()

let directory: string
let database: Database
let clock: number

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-generated-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now: () => at(clock) })
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

describe('Random operations on a real database', () => {
  test.each([1, 7, 42, 2026, 31_337, 99_999])('keep every invariant with seed %i', (seed) => {
    const random = seededRandom(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
    const chance = (p: number) => random() < p
    const now = () => at(clock)
    const applied: string[] = []
    let accepted = 0

    for (const id of SESSIONS)
      touchSession(database, { id, kind: 'worker', projectDir: `/w/${id}` }, now(), 1)

    const steps = () =>
      Array.from({ length: 1 + Math.floor(random() * 3) }, (_, index) => ({
        title: `Step ${index + 1}`,
        owner: pick<Owner>(['agent', 'agent', 'you']),
      }))

    for (let index = 0; index < OPERATIONS; index++) {
      clock += Math.floor(random() * 20)
      const known =
        (
          read(database, (sqlite) => sqlite.prepare('SELECT max(id) AS n FROM tasks').get()) as {
            n: number | null
          }
        ).n ?? 0
      const task = known === 0 || chance(0.03) ? known + 1 : 1 + Math.floor(random() * known)
      const actor = pick(ACTORS)
      const session = pick(SESSIONS)

      const operations: Array<[string, () => services.ServiceResult<unknown>]> = [
        [
          'addTask',
          () =>
            services.addTask(database, actor, now(), {
              title: `Task ${known + 1}`,
              steps: steps(),
              queue: chance(0.7),
            }),
        ],
        [
          'addTask',
          () =>
            services.addTask(database, actor, now(), {
              title: `Task ${known + 1}`,
              steps: steps(),
            }),
        ],
        ['queueTask', () => services.queueTask(database, actor, now(), task)],
        [
          'reorderQueue',
          () => services.reorderQueue(database, 'you', now(), task, 1 + Math.floor(random() * 5)),
        ],
        ['claimStep', () => services.claimStep(database, session, now())],
        ['claimStep named', () => services.claimStep(database, session, now(), task)],
        [
          'updateStep',
          () => services.updateStep(database, session, now(), task, { note: 'Progress' }),
        ],
        ['askYou', () => services.askYou(database, session, now(), task, 'Which?')],
        ['answerQuestion', () => services.answerQuestion(database, 'you', now(), task, 'That one')],
        [
          'completeStep',
          () => services.completeStep(database, session, now(), task, { summary: 'Done' }),
        ],
        [
          'completeStep',
          () => services.completeStep(database, session, now(), task, { summary: 'Done' }),
        ],
        [
          'completeMyStep',
          () => services.completeMyStep(database, 'you', now(), task, { note: 'Checked' }),
        ],
        ['moveToBacklog', () => services.moveToBacklog(database, actor, now(), task)],
        ['signOff', () => services.signOff(database, 'you', now(), task)],
        [
          'addFollowUp',
          () =>
            services.addFollowUp(database, actor, now(), task, {
              steps: steps(),
              placement: pick(['first', 'last'] as const),
            }),
        ],
        ['archiveTask', () => services.archiveTask(database, actor, now(), task)],
        ['collectAnswer', () => services.collectAnswer(database, task, session)],
        [
          'time passes',
          () => {
            clock += Math.floor(random() * 200)
            return touchSession(
              database,
              { id: session, kind: 'worker', projectDir: `/w/${session}` },
              now(),
              1
            )
          },
        ],
      ]
      const [name, run] = pick(operations)
      const before = readRevision(database)
      const result = run()
      const after = readRevision(database)
      applied.push(
        `${name}(T-${task}, ${actor}/${session}) at ${clock}s → ${isRefusal(result) ? result.code : 'ok'}`
      )
      const context = `Seed ${seed}, after:\n${applied.join('\n')}`

      if (isRefusal(result)) {
        expect(after, context).toBe(before)
      } else {
        accepted++
        succeeded.add(name)
        expect(after - before, context).toBeLessThanOrEqual(1)
      }
      const violations = read(database, (sqlite) => boardViolations(allTaskStates(sqlite)))
      expect(violations, context).toEqual([])
    }
    expect(accepted).toBeGreaterThan(OPERATIONS / 4)
  })

  test('reach every operation', () => {
    expect([...succeeded].sort()).toEqual([
      'addFollowUp',
      'addTask',
      'answerQuestion',
      'archiveTask',
      'askYou',
      'claimStep',
      'claimStep named',
      'collectAnswer',
      'completeMyStep',
      'completeStep',
      'moveToBacklog',
      'queueTask',
      'reorderQueue',
      'signOff',
      'time passes',
      'updateStep',
    ])
  })
})
