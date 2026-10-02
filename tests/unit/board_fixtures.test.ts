import { describe, expect, test } from 'vitest'
import { currentStep } from '../../domain/chain.js'
import { canAct, counts, holdings, listOf, type BoardList } from '../../domain/derived.js'
import { boardViolations } from '../../domain/invariants.js'
import type { Step, Task, TaskState, TaskStatus } from '../../domain/types.js'
import { boardPropsSchema, type BoardProps, type Pip, type TaskRef } from '../../shared/props.js'
import { NAMED_BOARD_PROPS } from '../../view/entries/board/fixtures.js'

/**
 * What a board item says about its task beyond its pips.
 */
interface ItemFacts {
  queuePosition?: number
  finishedAt?: string
  signedOffAt?: string
  question?: string
  runningSince?: string
  waitingSince?: string
}

const STATUS_OF: Record<BoardList, TaskStatus> = {
  yourTurn: 'active',
  working: 'active',
  queue: 'queue',
  backlog: 'backlog',
  toSignOff: 'done',
  signedOff: 'done',
}

/**
 * A signed-off item carries no pips, so its chain is one done step.
 */
function signedOffPips(task: TaskRef): Pip[] {
  return [
    { id: `${task.id}.1`, owner: 'agent', status: 'done', title: task.title, sessionName: null },
  ]
}

/**
 * The task and chain a board item stands for, as the domain holds them.
 */
function stateOf(
  board: BoardProps,
  list: BoardList,
  ref: TaskRef,
  pips: readonly Pip[],
  facts: ItemFacts
): TaskState {
  const sessionId = (name: string | null) => {
    if (name === null) return null
    const session = board.sessions.find((candidate) => candidate.name === name)
    expect(session, `${ref.displayId} names the session “${name}”`).toBeDefined()
    return session!.id
  }
  const task: Task = {
    id: Number(ref.id),
    title: ref.title,
    status: STATUS_OF[list],
    queuePosition: facts.queuePosition ?? null,
    createdBy: 'you',
    createdAt: board.now,
    finishedAt: facts.finishedAt ?? null,
    signedOffAt: facts.signedOffAt ?? null,
    archivedAt: null,
    assignedTo: null,
  }
  const steps = pips.map((pip, index): Step => ({
    id: pip.id,
    taskId: task.id,
    number: index + 1,
    owner: pip.owner,
    title: pip.title,
    detail: null,
    status: pip.status,
    origin: 'chain',
    claimedBy: sessionId(pip.sessionName),
    question: pip.status === 'waiting' ? (facts.question ?? null) : null,
    answer: null,
    note: null,
    summary: null,
    links: [],
    startedAt: pip.status === 'pending' ? null : board.now,
    runningSince: pip.status === 'running' ? (facts.runningSince ?? null) : null,
    waitingSince: pip.status === 'waiting' ? (facts.waitingSince ?? null) : null,
    finishedAt: pip.status === 'done' ? board.now : null,
    elapsedSeconds: 0,
    waitedSeconds: 0,
  }))
  return { task, steps }
}

interface Entry {
  list: BoardList
  state: TaskState
  canAct?: Record<string, boolean | undefined>
  step?: { number: number; title: string }
}

function entriesOf(board: BoardProps): Entry[] {
  return [
    ...board.yourTurn.map((item) => ({
      list: 'yourTurn' as const,
      state: stateOf(board, 'yourTurn', item.task, item.steps, {
        question: item.step.question,
        waitingSince: item.step.waitingSince,
      }),
      canAct: item.canAct,
      step: item.step,
    })),
    ...board.working.map((item) => ({
      list: 'working' as const,
      state: stateOf(board, 'working', item.task, item.steps, {
        runningSince: item.step.runningSince,
      }),
      step: item.step,
    })),
    ...board.queue.map((item) => ({
      list: 'queue' as const,
      state: stateOf(board, 'queue', item.task, item.steps, { queuePosition: item.position }),
      canAct: item.canAct,
    })),
    ...board.backlog.map((item) => ({
      list: 'backlog' as const,
      state: stateOf(board, 'backlog', item.task, item.steps, {}),
      canAct: item.canAct,
    })),
    ...board.toSignOff.map((item) => ({
      list: 'toSignOff' as const,
      state: stateOf(board, 'toSignOff', item.task, item.steps, { finishedAt: item.finishedAt }),
      canAct: item.canAct,
    })),
    ...board.signedOff.map((item) => ({
      list: 'signedOff' as const,
      state: stateOf(board, 'signedOff', item.task, signedOffPips(item.task), {
        finishedAt: item.signedOffAt,
        signedOffAt: item.signedOffAt,
      }),
    })),
  ]
}

const BOARDS = Object.entries(NAMED_BOARD_PROPS)

describe.each(BOARDS)('%s', (_name, board) => {
  const entries = entriesOf(board)
  const states = entries.map(({ state }) => state)

  test('is a valid BoardProps', () => {
    expect(() => boardPropsSchema.parse(board)).not.toThrow()
  })

  test('every task and step keeps the invariants of 03', () => {
    expect(boardViolations(states)).toEqual([])
  })

  test('every task is in the list the domain puts it in', () => {
    for (const { list, state } of entries) {
      expect(listOf(state), `T-${state.task.id}`).toBe(list)
    }
  })

  test('each item names its current step', () => {
    for (const { state, step } of entries.filter((entry) => entry.step)) {
      const current = currentStep(state.steps)
      expect({ number: step!.number, title: step!.title }).toEqual({
        number: current.number,
        title: current.title,
      })
    }
  })

  test('canAct offers exactly what the domain would accept', () => {
    for (const { state, canAct: offered } of entries.filter((entry) => entry.canAct)) {
      const accepted: Record<string, boolean> = { ...canAct(state) }
      for (const [action, value] of Object.entries(offered!)) {
        expect(value ?? false, `T-${state.task.id} ${action}`).toBe(accepted[action])
      }
    }
  })

  test('counts equal the lengths of the lists and what the domain counts', () => {
    expect(board.counts).toEqual({
      yourTurn: board.yourTurn.length,
      working: board.working.length,
      queue: board.queue.length,
      toSignOff: board.toSignOff.length,
    })
    expect(board.counts).toEqual(counts(states))
  })

  test('every session name in a pip names a session on the board', () => {
    const names = new Set(board.sessions.map((session) => session.name))
    const pips = [
      ...board.yourTurn,
      ...board.working,
      ...board.queue,
      ...board.backlog,
      ...board.toSignOff,
    ].flatMap((item) => item.steps)
    for (const pip of pips) {
      if (pip.sessionName !== null) expect(names).toContain(pip.sessionName)
    }
  })

  test('each live session holds the step the domain says it holds, and an ended one nothing', () => {
    for (const session of board.sessions) {
      const [held] = holdings(session.id, states)
      if (!session.live) {
        expect(held).toBeUndefined()
        expect(session.holding).toBeUndefined()
        continue
      }
      expect(session.holding ?? null).toEqual(
        held
          ? {
              task: {
                id: String(held.task.id),
                displayId: expect.any(String),
                title: held.task.title,
              },
              step: { number: held.step.number, title: held.step.title },
              status: held.status,
            }
          : null
      )
    }
  })

  test('a released task is back in the queue or the backlog', () => {
    for (const released of board.sessions.flatMap((session) => session.released ?? [])) {
      const entry = entries.find(({ state }) => String(state.task.id) === released.id)
      expect(['queue', 'backlog']).toContain(entry?.list)
    }
  })
})
