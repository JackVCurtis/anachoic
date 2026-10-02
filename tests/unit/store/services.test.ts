import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard } from '../../../domain/invariants.js'
import { isRefusal, type Refusal } from '../../../domain/refusal.js'
import type { Actor, Owner } from '../../../domain/types.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readBoard, readRevision, readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import {
  addFollowUp,
  addTask,
  answerQuestion,
  archiveTask,
  askYou,
  claimStep,
  collectAnswer,
  completeMyStep,
  completeStep,
  moveToBacklog,
  queueTask,
  readAnswerState,
  reorderQueue,
  signOff,
  updateStep,
  type Acted,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { at } from '../support/domain.js'
import { buildChild, forkChild } from '../support/child.js'
import { allTaskStates } from '../support/store.js'

const CHILD = resolve(import.meta.dirname, '../support/store_child.ts')
const A = 'session-a'
const B = 'session-b'

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-services-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now })
  touchSession(database, { id: A, kind: 'worker', projectDir: '/w/api-server' }, now(), 1)
  touchSession(database, { id: B, kind: 'worker', projectDir: '/w/web-client' }, now(), 2)
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function ok(result: ServiceResult): Acted {
  if (isRefusal(result)) expect.fail(`Refused with ${result.code}: ${result.sentence}`)
  read(database, (sqlite) => checkBoard(allTaskStates(sqlite)))
  return result.value
}

function dump() {
  return read(database, (sqlite) =>
    ['board', 'tasks', 'steps', 'sessions', 'events'].map((table) =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()
    )
  )
}

/**
 * Runs a service that must refuse, and checks that nothing changed.
 */
function refuses(run: () => ServiceResult<unknown>, code: Refusal['code'], sentence?: string) {
  const before = dump()
  const result = run()
  expect(isRefusal(result), JSON.stringify(result)).toBe(true)
  expect((result as Refusal).code).toBe(code)
  if (sentence !== undefined) expect((result as Refusal).sentence).toBe(sentence)
  expect(dump()).toEqual(before)
}

function add(owners: Owner[], options: { queue?: boolean; actor?: Actor } = {}) {
  return ok(
    addTask(database, options.actor ?? 'you', now(), {
      title: 'Add retries',
      steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
      queue: options.queue,
    })
  ).state.task.id
}

function claimed(owners: Owner[], session = A) {
  const id = add(owners)
  ok(claimStep(database, session, now(), id))
  return id
}

function positionOf(id: number) {
  return readTask(database, id)!.state.task.queuePosition
}

describe('addTask', () => {
  test('adds to the queue by default, numbering tasks in sequence', () => {
    const first = ok(
      addTask(database, A, now(), { title: 'One', steps: [{ title: 'Do', owner: 'agent' }] })
    )
    const second = ok(
      addTask(database, 'you', now(), { title: 'Two', steps: [{ title: 'Do', owner: 'agent' }] })
    )
    expect(first.state.task).toMatchObject({
      id: 1,
      status: 'queue',
      queuePosition: 1,
      createdBy: A,
    })
    expect(second.state.task).toMatchObject({
      id: 2,
      status: 'queue',
      queuePosition: 2,
      createdBy: 'you',
    })
    expect(first.events.map((event) => event.kind)).toEqual(['added', 'queued'])
  })

  test('adds to the backlog, and starts at once when the first step is yours', () => {
    expect(readTask(database, add(['agent'], { queue: false }))!.state.task.status).toBe('backlog')
    const started = readTask(database, add(['you', 'agent']))!.state
    expect(started.task).toMatchObject({ status: 'active', queuePosition: null })
    expect(started.steps[0].status).toBe('waiting')
  })

  test('never reuses a number, even after an archive', () => {
    const first = add(['agent'])
    ok(archiveTask(database, 'you', now(), first))
    expect(add(['agent'])).toBe(first + 1)
  })

  test.each([
    [
      'an empty title',
      { title: ' ', steps: [{ title: 'x', owner: 'agent' }] },
      'title must be 1 to 200 characters',
    ],
    [
      'a long title',
      { title: 'x'.repeat(201), steps: [{ title: 'x', owner: 'agent' }] },
      'title must be 1 to 200 characters',
    ],
    ['no steps', { title: 'x', steps: [] }, 'steps must be 1 to 20 steps'],
    [
      '21 steps',
      { title: 'x', steps: Array(21).fill({ title: 'x', owner: 'agent' }) },
      'steps must be 1 to 20 steps',
    ],
    [
      'a long detail',
      { title: 'x', steps: [{ title: 'x', owner: 'agent', detail: 'x'.repeat(4001) }] },
      'steps[0].detail must be at most 4,000 characters',
    ],
    [
      'an unknown owner',
      { title: 'x', steps: [{ title: 'x', owner: 'robot' }] },
      'steps[0].owner must be agent or you',
    ],
  ])('refuses %s', (_label, input, sentence) => {
    refuses(() => addTask(database, 'you', now(), input as never), 'invalid', sentence)
  })
})

describe('queueTask and reorderQueue', () => {
  test('queues a backlog task at the back', () => {
    add(['agent'])
    const id = add(['agent'], { queue: false })
    expect(ok(queueTask(database, B, now(), id)).state.task.queuePosition).toBe(2)
  })

  test('refuses a task in the queue, an unknown task and a malformed id', () => {
    const id = add(['agent'])
    refuses(
      () => queueTask(database, 'you', now(), id),
      'wrong_status',
      'T-001 is in the queue, not in the backlog'
    )
    refuses(() => queueTask(database, 'you', now(), 99), 'not_found', 'T-099 does not exist')
    refuses(() => queueTask(database, 'you', now(), 'T12'), 'invalid')
  })

  test('reorders the queue, closing up behind', () => {
    const [one, two, three] = [add(['agent']), add(['agent']), add(['agent'])]
    ok(reorderQueue(database, 'you', now(), three, 1))
    expect([one, two, three].map(positionOf)).toEqual([2, 3, 1])
    ok(reorderQueue(database, 'you', now(), three, 99))
    expect([one, two, three].map(positionOf)).toEqual([1, 2, 3])
  })

  test('reorder is yours alone, and needs a position from 1', () => {
    const id = add(['agent'])
    refuses(
      () => reorderQueue(database, A, now(), id, 1),
      'not_yours',
      'Only you can reorder T-001'
    )
    refuses(() => reorderQueue(database, 'you', now(), id, 0), 'invalid')
  })
})

describe('claimStep', () => {
  test('with no task, claims the task at queue position 1', () => {
    const [first, second] = [add(['agent']), add(['agent'])]
    const claim = ok(claimStep(database, A, now()))
    expect(claim.state.task.id).toBe(first)
    expect(claim.state.steps[0]).toMatchObject({ status: 'running', claimedBy: A })
    expect(positionOf(second)).toBe(1)
  })

  test('with no task, refuses an empty queue', () => {
    add(['agent'], { queue: false })
    refuses(
      () => claimStep(database, A, now()),
      'nothing_to_claim',
      'Nothing in the queue needs an agent'
    )
  })

  test('with a task, claims it wherever it sits, and refuses one not queued', () => {
    add(['agent'])
    const later = add(['agent'])
    expect(ok(claimStep(database, B, now(), later)).state.task.id).toBe(later)
    refuses(
      () => claimStep(database, A, now(), later),
      'wrong_status',
      'T-002 is active, not in the queue'
    )
  })
})

describe('Worker services', () => {
  test('updateStep records a note and links on the caller’s step', () => {
    const id = claimed(['agent'])
    const links = [{ label: 'PR', url: 'https://example.com/1' }]
    expect(
      ok(updateStep(database, A, now(), id, { note: 'Halfway', links })).state.steps[0]
    ).toMatchObject({ note: 'Halfway', links })
    refuses(
      () => updateStep(database, B, now(), id, { note: 'x' }),
      'not_yours',
      'Step 1 of T-001 is claimed by api-server'
    )
    refuses(
      () => updateStep(database, A, now(), id, { note: 'x'.repeat(501) }),
      'invalid',
      'note must be 1 to 500 characters'
    )
    refuses(
      () => updateStep(database, A, now(), id, { note: 'x', links: Array(11).fill(links[0]) }),
      'invalid',
      'links must be at most 10 links'
    )
  })

  test('askYou makes the step wait, and a second ask is unanswered', () => {
    const id = claimed(['agent'])
    expect(ok(askYou(database, A, now(), id, 'Redis?')).state.steps[0]).toMatchObject({
      status: 'waiting',
      question: 'Redis?',
    })
    refuses(
      () => askYou(database, A, now(), id, 'Again?'),
      'unanswered',
      'Step 1 of T-001 is waiting for your answer'
    )
    refuses(() => completeStep(database, A, now(), id, { summary: 'x' }), 'unanswered')
  })

  test('answerQuestion runs the step again with the answer, recording answered', () => {
    const id = claimed(['agent'])
    ok(askYou(database, A, now(), id, 'Redis?'))
    const answered = ok(answerQuestion(database, 'you', now(), id, 'Redis'))
    expect(answered.state.steps[0]).toMatchObject({
      status: 'running',
      answer: 'Redis',
      question: null,
    })
    expect(answered.events).toMatchObject([
      { kind: 'answered', sessionId: 'you', stepId: `${id}.1` },
    ])
    refuses(() => answerQuestion(database, 'you', now(), id, 'Again'), 'wrong_status')
    refuses(
      () => answerQuestion(database, 'you', now(), id, ''),
      'invalid',
      'answer must be 1 to 4,000 characters'
    )
  })

  test('complete_step with a next agent step puts the task at position 1 ahead of older queued tasks, and the session claims it at once', () => {
    const id = claimed(['agent', 'agent'])
    const [older, oldest] = [add(['agent']), add(['agent'])]
    const completed = ok(completeStep(database, A, now(), id, { summary: 'First half' }))
    expect(completed.state.task).toMatchObject({ status: 'queue', queuePosition: 1 })
    expect([older, oldest].map(positionOf)).toEqual([2, 3])
    const next = ok(claimStep(database, A, now(), id))
    expect(next.state.steps[1]).toMatchObject({ status: 'running', claimedBy: A })
  })

  test('complete_step with your next step leaves the task active, and with none makes it done', () => {
    const yours = claimed(['agent', 'you'])
    expect(ok(completeStep(database, A, now(), yours, { summary: 'x' })).state.task.status).toBe(
      'active'
    )
    const last = claimed(['agent'])
    expect(ok(completeStep(database, A, now(), last, { summary: 'x' })).state.task).toMatchObject({
      status: 'done',
      finishedAt: now(),
    })
  })

  test('calls on a step whose claim ended are refused, and say why', () => {
    const parked = claimed(['agent'])
    ok(moveToBacklog(database, 'you', now(), parked))
    refuses(
      () => updateStep(database, A, now(), parked, { note: 'x' }),
      'wrong_status',
      'T-001 is in the backlog, not active. It was parked. Stop work on it.'
    )
    const archived = claimed(['agent'])
    ok(archiveTask(database, 'you', now(), archived))
    refuses(
      () => completeStep(database, A, now(), archived, { summary: 'x' }),
      'archived',
      'T-002 was archived'
    )
  })
})

describe('Your services', () => {
  test('completeMyStep marks your step done with a note and moves the chain on', () => {
    const id = add(['you', 'agent'])
    const done = ok(completeMyStep(database, 'you', now(), id, { note: 'Fine' }))
    expect(done.state.steps[0]).toMatchObject({ status: 'done', note: 'Fine' })
    expect(done.state.task).toMatchObject({ status: 'queue', queuePosition: 1 })
    refuses(() => completeMyStep(database, A, now(), id), 'not_yours')
  })

  test('moveToBacklog parks an active task and unqueues a queued one', () => {
    const active = claimed(['agent'])
    const queued = add(['agent'])
    expect(ok(moveToBacklog(database, 'you', now(), active)).state.steps[0]).toMatchObject({
      status: 'pending',
      claimedBy: null,
    })
    expect(ok(moveToBacklog(database, 'you', now(), queued)).state.task).toMatchObject({
      status: 'backlog',
      queuePosition: null,
    })
    refuses(() => moveToBacklog(database, 'you', now(), queued), 'wrong_status')
  })

  test('signOff, follow-up and archive on done tasks', () => {
    const id = claimed(['agent'])
    ok(completeStep(database, A, now(), id, { summary: 'x' }))
    refuses(() => signOff(database, A, now(), id), 'not_yours')
    const followed = ok(
      addFollowUp(database, B, now(), id, {
        placement: 'first',
        steps: [{ title: 'More', owner: 'agent' }],
      })
    )
    expect(followed.state.task).toMatchObject({
      status: 'queue',
      queuePosition: 1,
      finishedAt: null,
    })
    ok(claimStep(database, A, now()))
    ok(completeStep(database, A, now(), id, { summary: 'y' }))
    expect(ok(signOff(database, 'you', now(), id)).state.task.signedOffAt).toBe(now())
    refuses(() => signOff(database, 'you', now(), id), 'signed_off', 'T-001 is signed off')
    refuses(
      () =>
        addFollowUp(database, 'you', now(), id, {
          placement: 'last',
          steps: [{ title: 'x', owner: 'agent' }],
        }),
      'signed_off'
    )
    refuses(() => archiveTask(database, 'you', now(), id), 'signed_off')
    refuses(
      () =>
        addFollowUp(database, 'you', now(), id, {
          placement: 'middle' as never,
          steps: [{ title: 'x', owner: 'agent' }],
        }),
      'invalid'
    )
  })

  test('every action on an archived task is refused', () => {
    const id = add(['agent'])
    ok(archiveTask(database, 'you', now(), id))
    refuses(() => archiveTask(database, 'you', now(), id), 'archived', 'T-001 was archived')
    refuses(() => queueTask(database, 'you', now(), id), 'archived')
    refuses(() => claimStep(database, A, now(), id), 'archived')
  })
})

describe('Events', () => {
  test('every service appends exactly its transition’s events, and the task’s events read back in order', () => {
    const results: Acted[] = []
    const id = add(['agent', 'you'])
    results.push(ok(claimStep(database, A, now(), id)))
    results.push(ok(updateStep(database, A, now(), id, { note: 'Going' })))
    results.push(ok(askYou(database, A, now(), id, 'Which?')))
    results.push(ok(answerQuestion(database, 'you', now(), id, 'That')))
    results.push(ok(completeStep(database, A, now(), id, { summary: 'Done' })))
    results.push(ok(completeMyStep(database, 'you', now(), id)))
    results.push(ok(signOff(database, 'you', now(), id)))

    const stored = readTask(database, id)!.events
    expect(stored.map((event) => event.kind)).toEqual([
      'added',
      'queued',
      'claimed',
      'noted',
      'asked',
      'answered',
      'completed',
      'started',
      'completed',
      'signed_off',
    ])
    expect(stored.slice(2).map(({ id: _id, ...event }) => event)).toEqual(
      results.flatMap((result) => result.events)
    )
    expect(stored.map((event) => event.id)).toEqual(
      [...stored.map((event) => event.id)].sort((a, b) => a - b)
    )
  })
})

describe('Collecting your answer', () => {
  test('collectAnswer returns the answer once', () => {
    const id = claimed(['agent'])
    ok(askYou(database, A, now(), id, 'Which?'))
    expect(readAnswerState(database, id, A)).toEqual({ kind: 'waiting' })
    ok(answerQuestion(database, 'you', now(), id, 'That one'))
    expect(readAnswerState(database, id, A)).toEqual({ kind: 'answered', answer: 'That one' })
    const revision = readRevision(database)
    expect(collectAnswer(database, id, A)).toEqual({
      value: { kind: 'answered', answer: 'That one' },
      revision: revision + 1,
    })
    expect(collectAnswer(database, id, A)).toMatchObject({
      value: { kind: 'none' },
      revision: revision + 1,
    })
  })

  test.each([
    [
      'a park',
      (id: number) => moveToBacklog(database, 'you', now(), id),
      'parked',
      'T-001 was parked. Stop work on it.',
    ],
    [
      'an archive',
      (id: number) => archiveTask(database, 'you', now(), id),
      'archived',
      'T-001 was archived. Stop work on it.',
    ],
  ])('collectAnswer reports the end of the claim after %s', (_label, end, reason, sentence) => {
    const id = claimed(['agent'])
    ok(askYou(database, A, now(), id, 'Which?'))
    ok(end(id))
    expect(readAnswerState(database, id, A)).toEqual({ kind: 'ended', reason, sentence })
    expect(collectAnswer(database, id, A)).toMatchObject({
      value: { kind: 'ended', reason, sentence },
    })
  })
})

describe('Reading the board', () => {
  test('readBoard returns open tasks, the 10 latest signed off, the sessions and the revision', () => {
    const open = add(['agent'])
    for (let index = 0; index < 12; index++) {
      clock += 1
      const id = claimed(['agent'])
      ok(completeStep(database, A, now(), id, { summary: 'x' }))
      ok(signOff(database, 'you', now(), id))
    }
    const archived = add(['agent'])
    ok(archiveTask(database, 'you', now(), archived))
    const board = readBoard(database, now())
    expect(board.tasks.map((state) => state.task.id)).toEqual([open])
    expect(board.signedOff.map((state) => state.task.id)).toEqual([
      13, 12, 11, 10, 9, 8, 7, 6, 5, 4,
    ])
    expect(board.sessions.map((each) => each.session.name)).toEqual(['api-server', 'web-client'])
    expect(board.revision).toBe(readRevision(database))
  })
})

describe('Several processes', () => {
  test('two processes claiming the same queued task at once: exactly one wins', async () => {
    const script = await buildChild(CHILD)
    for (const named of [true, false]) {
      const id = add(['agent'])
      const children = [A, B].map((session) =>
        forkChild<{ ready: true } | { code: string }>(script, [
          'claim',
          database.file,
          session,
          named ? String(id) : '',
        ])
      )
      await Promise.all(children.map((child) => child.next()))
      for (const child of children) child.process.send('go')
      const results = await Promise.all(
        children.map((child) => child.next() as Promise<{ code: string }>)
      )
      const codes = results.map((result) => result.code)
      await Promise.all(children.map((child) => child.exited))
      expect(codes.filter((code) => code === 'claimed')).toHaveLength(1)
      expect(codes.filter((code) => code !== 'claimed')).toEqual([
        named ? 'wrong_status' : 'nothing_to_claim',
      ])
      expect(readTask(database, id)!.state.steps[0]).toMatchObject({ status: 'running' })
    }
  }, 30_000)
})
