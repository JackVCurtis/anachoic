import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { canAct } from '../../../domain/derived.js'
import { isRefusal } from '../../../domain/refusal.js'
import { YOU, type Actor, type Owner } from '../../../domain/types.js'
import { boardProps, readBoardProps } from '../../../server/props/board.js'
import { boardPropsSchema, type BoardProps } from '../../../shared/props.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readBoard, readTask } from '../../../store/queries.js'
import {
  addTask,
  archiveTask,
  askYou,
  blockStep,
  claimStep,
  completeStep,
  signOff,
  updateStep,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { write } from '../../../store/write.js'
import { at } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'
const C = 'session-c'
const MINUTE = 60

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-props-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now })
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function done<T>(result: ServiceResult<T>): T {
  if (isRefusal(result)) throw new Error(result.sentence)
  return result.value
}

function touch(id: string, project: string, kind: 'worker' | 'dedicated' = 'worker') {
  done(touchSession(database, { id, kind, projectDir: project }, now(), 1))
}

function add(title: string, owners: Owner[], queue = true, actor: Actor = A) {
  const steps = owners.map((owner, index) => ({ title: `${title} ${index + 1}`, owner }))
  return done(addTask(database, actor, now(), { title, steps, queue })).state.task.id
}

/**
 * One task in every list, one archived, and three sessions.
 */
function everyList() {
  touch('dedicated', '', 'dedicated')
  touch(A, '/w/api-server')
  touch(B, '/w/web-client')
  const ids = {
    backlog: add('Backlog', ['agent'], false),
    queued: add('Queued', ['agent', 'you']),
    working: add('Working', ['agent']),
    yours: add('Yours', ['you', 'agent']),
    asks: add('Asks', ['agent']),
    toSignOff: add('Sign off', ['agent']),
    signedOff: add('Signed off', ['agent']),
    archived: add('Archived', ['agent'], false),
  }
  for (const [actor, id] of [
    [A, ids.working],
    [B, ids.asks],
    [A, ids.toSignOff],
    [A, ids.signedOff],
  ] as const) {
    done(claimStep(database, actor, now(), id))
  }
  done(updateStep(database, A, now(), ids.working, { note: 'Halfway' }))
  done(askYou(database, B, now(), ids.asks, 'Which one?'))
  done(
    completeStep(database, A, now(), ids.toSignOff, {
      summary: 'Done',
      links: [{ label: 'PR', url: 'u' }],
    })
  )
  done(completeStep(database, A, now(), ids.signedOff, { summary: 'Done' }))
  done(signOff(database, YOU, now(), ids.signedOff))
  done(archiveTask(database, YOU, now(), ids.archived))
  return ids
}

function listed(props: BoardProps) {
  return {
    yourTurn: props.yourTurn.map(({ task }) => task.id),
    working: props.working.map(({ task }) => task.id),
    queue: props.queue.map(({ task }) => task.id),
    backlog: props.backlog.map(({ task }) => task.id),
    toSignOff: props.toSignOff.map(({ task }) => task.id),
    signedOff: props.signedOff.map(({ task }) => task.id),
  }
}

describe('boardProps', () => {
  test('puts each task that is not archived in exactly one list, and omits archived tasks', () => {
    const ids = everyList()
    const props = boardPropsSchema.parse(readBoardProps(database, now()))

    expect(listed(props)).toEqual({
      yourTurn: [String(ids.yours), String(ids.asks)],
      working: [String(ids.working)],
      queue: [String(ids.queued)],
      backlog: [String(ids.backlog)],
      toSignOff: [String(ids.toSignOff)],
      signedOff: [String(ids.signedOff)],
    })
    expect(Object.values(listed(props)).flat()).not.toContain(String(ids.archived))
    expect(props.counts).toEqual({ yourTurn: 2, working: 1, queue: 1, toSignOff: 1 })
  })

  test('names the step, its session and its times, and carries the instants intervals began', () => {
    const ids = everyList()
    clock = 90
    touch(A, '/w/api-server')
    touch(B, '/w/web-client')
    const props = readBoardProps(database, now())

    expect(props.working[0]).toMatchObject({
      task: { id: String(ids.working), displayId: 'T-003', title: 'Working' },
      step: { number: 1, title: 'Working 1', note: 'Halfway', runningSince: at(0) },
      session: { id: A, name: 'api-server' },
      steps: [
        {
          id: '3.1',
          owner: 'agent',
          status: 'running',
          title: 'Working 1',
          sessionName: 'api-server',
        },
      ],
    })
    expect(props.yourTurn).toEqual([
      expect.objectContaining({
        step: { number: 1, title: 'Yours 1', owner: 'you', waitingSince: at(0) },
      }),
      expect.objectContaining({
        step: {
          number: 1,
          title: 'Asks 1',
          owner: 'agent',
          question: 'Which one?',
          waitingSince: at(0),
        },
        session: { id: B, name: 'web-client' },
      }),
    ])
    expect(props.yourTurn[0]).not.toHaveProperty('session')
    expect(props.queue[0]).toMatchObject({ position: 1, nextOwner: 'agent' })
    expect(props.toSignOff[0]).toMatchObject({ finishedAt: at(0), linkCount: 1, agentSeconds: 0 })
    expect(props.signedOff[0]).toMatchObject({ signedOffAt: at(0) })
    expect(props.sessions).toEqual([
      { id: 'dedicated', kind: 'dedicated', name: 'This chat', live: true },
      {
        id: A,
        kind: 'worker',
        name: 'api-server',
        live: true,
        holding: {
          task: {
            id: String(ids.working),
            displayId: 'T-003',
            title: 'Working',
            assignedTo: null,
          },
          step: { number: 1, title: 'Working 1' },
          status: 'running',
        },
      },
      {
        id: B,
        kind: 'worker',
        name: 'web-client',
        live: true,
        holding: expect.objectContaining({ status: 'waiting' }),
      },
    ])
  })

  test('canAct matches what the domain accepts for every action on every task', () => {
    everyList()
    const props = readBoardProps(database, now())
    const domain = (id: string) => canAct(readTask(database, Number(id))!.state)

    for (const item of props.yourTurn) {
      const accepts = domain(item.task.id)
      expect(item.canAct).toEqual({
        complete: accepts.complete,
        answer: accepts.answer,
        park: accepts.park,
      })
    }
    for (const item of props.queue) {
      const accepts = domain(item.task.id)
      expect(item.canAct).toEqual({ reorder: accepts.reorder, backlog: accepts.backlog })
    }
    for (const item of props.backlog) {
      const accepts = domain(item.task.id)
      expect(item.canAct).toEqual({ queue: accepts.queue, archive: accepts.archive })
    }
    for (const item of props.toSignOff) {
      const accepts = domain(item.task.id)
      expect(item.canAct).toEqual({
        signOff: accepts.signOff,
        followUp: accepts.followUp,
        archive: accepts.archive,
      })
    }
    expect(props.yourTurn.map(({ canAct: can }) => can)).toEqual([
      { complete: true, answer: false, park: true },
      { complete: false, answer: true, park: true },
    ])
  })

  test('a released session is listed with its released tasks for 10 minutes after it ended, and not after', () => {
    touch(C, '/w/docs')
    const released = add('Released', ['agent'], true, C)
    done(claimStep(database, C, now(), released))

    clock = 3 * MINUTE
    done(write(database, () => null))
    const endedAt = now()

    clock += 9 * MINUTE
    expect(readBoardProps(database, now()).sessions).toEqual([
      {
        id: C,
        kind: 'worker',
        name: 'docs',
        live: false,
        endedAt,
        released: [
          { id: String(released), displayId: 'T-001', title: 'Released', assignedTo: null },
        ],
      },
    ])
    expect(listed(readBoardProps(database, now())).queue).toEqual([String(released)])

    clock += 2 * MINUTE
    expect(readBoardProps(database, now()).sessions).toEqual([])
  })

  test('a session not seen for 2 minutes but not yet ended is not listed', () => {
    touch(A, '/w/api-server')
    clock = 3 * MINUTE
    expect(boardProps(readBoard(database, now()), now()).sessions).toEqual([])
  })
})

describe('a blocked step in the props', () => {
  test('is a Your turn item with its worker, the reason and the time it was blocked, and the worker holds it as blocked', () => {
    touch(A, '/w/api-server')
    const task = add('Deploy', ['agent'])
    done(claimStep(database, A, now(), task))
    clock = MINUTE
    touch(A, '/w/api-server')
    done(blockStep(database, A, now(), task, 'needs AWS credentials'))
    clock = 2 * MINUTE

    const props = boardPropsSchema.parse(readBoardProps(database, now()))
    expect(props.yourTurn).toHaveLength(1)
    expect(props.yourTurn[0]).toMatchObject({
      step: { number: 1, title: 'Deploy 1', owner: 'agent', waitingSince: at(MINUTE) },
      session: { id: A, name: 'api-server' },
      blocked: { reason: 'needs AWS credentials', since: at(MINUTE) },
      canAct: { complete: false, answer: false, park: true },
    })
    expect(props.yourTurn[0].step).not.toHaveProperty('question')
    expect(props.working).toEqual([])
    expect(props.counts.yourTurn).toBe(1)
    expect(props.sessions.find((session) => session.id === A)?.holding).toMatchObject({
      step: { number: 1 },
      status: 'blocked',
    })
  })

  test('items that are not blocked carry blocked: null', () => {
    touch(A, '/w/api-server')
    const task = add('Ask', ['agent'])
    done(claimStep(database, A, now(), task))
    done(askYou(database, A, now(), task, 'Which?'))
    add('Mine', ['you'])

    const props = readBoardProps(database, now())
    expect(props.yourTurn.map((item) => item.blocked)).toEqual([null, null])
  })
})
