import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { boardViolations } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { Actor, Owner } from '../../../domain/types.js'
import { OUTPUT_FORMATS } from '../../../shared/output_format.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readRevision } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import * as services from '../../../store/services.js'
import { sessionFromRow } from '../../../store/rows.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { at } from '../support/domain.js'
import { allTaskStates } from '../support/store.js'

const SESSIONS = ['session-a', 'session-b', 'session-c']
const ACTORS: Actor[] = ['you', ...SESSIONS]
const OPERATIONS = 600

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
      Array.from({ length: 1 + Math.floor(random() * 3) }, (_, index) => {
        const owner = pick<Owner>(['agent', 'agent', 'you'])
        return {
          title: `Step ${index + 1}`,
          owner,
          outputFormat: owner === 'you' && chance(0.5) ? pick(OUTPUT_FORMATS) : null,
        }
      })

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
        [
          'addTask assigned',
          () =>
            services.addTask(database, actor, now(), {
              title: `Task ${known + 1}`,
              steps: steps(),
              queue: chance(0.8),
              assignTo: chance(0.9) ? session : pick(['dedicated', 'nobody']),
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
          'claimStep of an assigned task',
          () => {
            const assigned = read(database, (sqlite) =>
              sqlite.prepare('SELECT id FROM tasks WHERE assigned_to IS NOT NULL').all()
            ) as Array<{ id: number }>
            return services.claimStep(
              database,
              session,
              now(),
              assigned.length > 0 ? pick(assigned).id : task
            )
          },
        ],
        [
          'updateStep',
          () => services.updateStep(database, session, now(), task, { note: 'Progress' }),
        ],
        ['askYou', () => services.askYou(database, session, now(), task, 'Which?')],
        [
          'askYou',
          () => {
            const running = read(database, (sqlite) =>
              sqlite
                .prepare("SELECT task_id AS id, claimed_by FROM steps WHERE status = 'running'")
                .all()
            ) as Array<{ id: number; claimed_by: string }>
            const [held] = running.length > 0 ? [pick(running)] : []
            return held
              ? services.askYou(database, held.claimed_by, now(), held.id, 'Which?')
              : services.askYou(database, session, now(), task, 'Which?')
          },
        ],
        ['answerQuestion', () => services.answerQuestion(database, 'you', now(), task, 'That one')],
        [
          'answerQuestion',
          () => {
            const waiting = read(database, (sqlite) =>
              sqlite
                .prepare(
                  "SELECT task_id AS id FROM steps WHERE owner = 'agent' AND status = 'waiting'"
                )
                .all()
            ) as Array<{ id: number }>
            return services.answerQuestion(
              database,
              'you',
              now(),
              waiting.length > 0 ? pick(waiting).id : task,
              'That one'
            )
          },
        ],
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
        [
          'completeMyStep with a URL',
          () =>
            services.completeMyStep(database, 'you', now(), task, {
              artifactUrl: pick(['https://example.com/pr/1', 'ftp://example.com/x']),
            }),
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
      const unassignedEvents = () =>
        (
          read(database, (sqlite) =>
            sqlite.prepare("SELECT count(*) AS n FROM events WHERE kind = 'unassigned'").get()
          ) as { n: number }
        ).n
      // The worker a task is assigned to is usually live: it has just been seen.
      if (name === 'addTask assigned' && chance(0.8)) {
        touchSession(
          database,
          { id: session, kind: 'worker', projectDir: `/w/${session}` },
          now(),
          1
        )
      }
      const unassignedBefore = unassignedEvents()
      const before = readRevision(database)
      const result = run()
      const after = readRevision(database)
      if (name.startsWith('claimStep')) {
        if (isRefusal(result) && result.sentence.includes('is assigned to')) {
          succeeded.add('claim refused by assignment')
        } else if (!isRefusal(result) && (result.value as services.Acted).state.task.assignedTo) {
          succeeded.add('assigned claim')
        }
      }
      if (unassignedEvents() > unassignedBefore) succeeded.add('release with unassign')
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
      const violations = read(database, (sqlite) =>
        boardViolations(
          allTaskStates(sqlite),
          sqlite.prepare('SELECT * FROM sessions').all().map(sessionFromRow)
        )
      )
      expect(violations, context).toEqual([])
    }
    expect(accepted).toBeGreaterThan(OPERATIONS / 4)
  })

  test('reach every operation', () => {
    expect([...succeeded].sort()).toEqual([
      'addFollowUp',
      'addTask',
      'addTask assigned',
      'answerQuestion',
      'archiveTask',
      'askYou',
      'assigned claim',
      'claim refused by assignment',
      'claimStep',
      'claimStep named',
      'claimStep of an assigned task',
      'collectAnswer',
      'completeMyStep',
      'completeMyStep with a URL',
      'completeStep',
      'moveToBacklog',
      'queueTask',
      'release with unassign',
      'reorderQueue',
      'signOff',
      'time passes',
      'updateStep',
    ])
  })
})
