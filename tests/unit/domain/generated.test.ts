import { describe, expect, test } from 'vitest'
import { currentStep } from '../../../domain/chain.js'
import { canAct, counts, listOf, type BoardList } from '../../../domain/derived.js'
import { taskViolations } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import {
  addToQueue,
  answer,
  archive,
  ask,
  block,
  claim,
  completeMyStep,
  completeStep,
  followUp,
  moveToBacklog,
  note,
  park,
  queue,
  release,
  reorder,
  signOff,
  start,
  unassign,
  unblock,
  unqueue,
  type Outcome,
} from '../../../domain/transitions.js'
import type { Actor, Owner, TaskState } from '../../../domain/types.js'
import { backlogTask, ctx } from '../support/domain.js'

const ACTORS: Actor[] = ['you', 'session-a', 'session-b']

type Operation = [name: string, apply: (state: TaskState, actor: Actor, seconds: number) => Outcome]

const OPERATIONS: Operation[] = [
  ['queue', (s, a, t) => queue(s, ctx(a, t))],
  ['unqueue', (s, a, t) => unqueue(s, ctx(a, t))],
  ['reorder', (s, a, t) => reorder(s, ctx(a, t), 2)],
  ['claim', (s, a, t) => claim(s, ctx(a, t))],
  ['start', (s, a, t) => start(s, ctx(a, t))],
  ['note', (s, a, t) => note(s, ctx(a, t), { note: 'Progress' })],
  ['ask', (s, a, t) => ask(s, ctx(a, t), 'Which?')],
  ['answer', (s, a, t) => answer(s, ctx(a, t), 'That one')],
  ['block', (s, a, t) => block(s, ctx(a, t), 'Needs credentials')],
  ['unblock', (s, a, t) => unblock(s, ctx(a, t), 'Resolved')],
  ['completeStep', (s, a, t) => completeStep(s, ctx(a, t), { summary: 'Done' })],
  ['completeMyStep', (s, a, t) => completeMyStep(s, ctx(a, t), { note: 'Checked' })],
  [
    'completeMyStep with a URL',
    (s, a, t) => completeMyStep(s, ctx(a, t), { artifactUrl: 'https://example.com/pr/1' }),
  ],
  ['park', (s, a, t) => park(s, ctx(a, t))],
  ['moveToBacklog', (s, a, t) => moveToBacklog(s, ctx(a, t))],
  ['release', (s, a, t) => release(s, ctx(a, t))],
  ['signOff', (s, a, t) => signOff(s, ctx(a, t))],
  [
    'followUp agent',
    (s, a, t) =>
      followUp(s, ctx(a, t), { placement: 'first', steps: [{ title: 'More', owner: 'agent' }] }),
  ],
  [
    'followUp you',
    (s, a, t) =>
      followUp(s, ctx(a, t), { placement: 'last', steps: [{ title: 'Check', owner: 'you' }] }),
  ],
  [
    'followUp you with a format',
    (s, a, t) =>
      followUp(s, ctx(a, t), {
        placement: 'first',
        steps: [{ title: 'Review', owner: 'you', outputFormat: 'pull_request' }],
      }),
  ],
  ['archive', (s, a, t) => archive(s, ctx(a, t))],
  ['unassign', (s, a, t) => unassign(s, ctx(a, t))],
]

/**
 * Every chain of 1 to 3 steps with every mix of owners.
 */
function chains(): Owner[][] {
  const result: Owner[][] = []
  const grow = (prefix: Owner[]) => {
    if (prefix.length > 0) result.push(prefix)
    if (prefix.length < 3) {
      grow([...prefix, 'agent'])
      grow([...prefix, 'you'])
    }
  }
  grow([])
  return result
}

/**
 * The parts of a state that decide which transitions apply.
 */
function shape({ task, steps }: TaskState): string {
  return JSON.stringify([
    task.status,
    task.signedOffAt !== null,
    task.archivedAt !== null,
    task.assignedTo,
    task.resumeWith,
    steps.map((step) => [
      step.owner,
      step.status,
      step.claimedBy,
      step.question !== null,
      step.answer !== null,
      step.blockedReason !== null,
      step.outputFormat,
      step.artifactUrl !== null,
    ]),
  ])
}

const MAX_STEPS = 5

/**
 * Every state reachable from a chain, applying every operation by every actor.
 * Each reached state is checked by `visit`, along with the path to it.
 */
function explore(owners: Owner[], visit: (state: TaskState, path: string[]) => void) {
  let seconds = 0
  const fromQueue = addToQueue(
    {
      taskId: 12,
      title: 'Task 12',
      steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
    },
    ctx('you')
  )
  const assigned = addToQueue(
    {
      taskId: 12,
      title: 'Task 12',
      steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
      assignTo: 'session-a',
    },
    ctx('you')
  )
  const starts: Array<[TaskState, string[]]> = [
    [backlogTask(owners), ['add']],
    [{ task: fromQueue.task, steps: fromQueue.steps }, ['addToQueue']],
    [{ task: assigned.task, steps: assigned.steps }, ['addToQueue assigned to session-a']],
  ]
  const seen = new Set<string>()
  const pending = [...starts]
  for (const [state, path] of starts) visit(state, path)
  while (pending.length > 0) {
    const [state, path] = pending.shift()!
    const key = shape(state)
    if (seen.has(key)) continue
    seen.add(key)
    for (const [name, apply] of OPERATIONS) {
      for (const actor of ACTORS) {
        seconds += 7
        const outcome = apply(state, actor, seconds)
        if (isRefusal(outcome)) continue
        const next = { task: outcome.task, steps: outcome.steps }
        const nextPath = [...path, `${name} by ${actor}`]
        visit(next, nextPath)
        if (next.steps.length <= MAX_STEPS) pending.push([next, nextPath])
      }
    }
  }
  return seen.size
}

const LIST_RULES: Record<BoardList, (state: TaskState) => boolean> = {
  yourTurn: ({ task, steps }) =>
    task.status === 'active' && currentStep(steps).status === 'waiting',
  working: ({ task, steps }) => task.status === 'active' && currentStep(steps).status === 'running',
  queue: ({ task }) => task.status === 'queue',
  backlog: ({ task }) => task.status === 'backlog',
  toSignOff: ({ task }) => task.status === 'done' && task.signedOffAt === null,
  signedOff: ({ task }) => task.status === 'done' && task.signedOffAt !== null,
}

const AS_YOU: Record<keyof ReturnType<typeof canAct>, (state: TaskState) => Outcome> = {
  complete: (s) => completeMyStep(s, ctx('you', 999), { artifactUrl: 'https://example.com' }),
  answer: (s) => answer(s, ctx('you', 999), 'Yes'),
  park: (s) => park(s, ctx('you', 999)),
  reorder: (s) => reorder(s, ctx('you', 999), 1),
  backlog: (s) => moveToBacklog(s, ctx('you', 999)),
  queue: (s) => queue(s, ctx('you', 999)),
  archive: (s) => archive(s, ctx('you', 999)),
  signOff: (s) => signOff(s, ctx('you', 999)),
  followUp: (s) =>
    followUp(s, ctx('you', 999), { placement: 'last', steps: [{ title: 'x', owner: 'agent' }] }),
}

/**
 * Exploring every reachable state takes a few seconds per chain, more while
 * the other suites run beside it.
 */
const EXPLORE_TIMEOUT_MS = 60_000

describe.each(chains().map((owners) => [owners.join(', '), owners] as const))(
  'A chain of %s',
  { timeout: EXPLORE_TIMEOUT_MS },
  (_label, owners) => {
    test('every transition from every reachable state keeps the invariants', () => {
      const states = explore(owners, (state, path) => {
        const found = taskViolations(state)
        expect(found, `After ${path.join(' → ')}`).toEqual([])
        if (state.task.assignedTo !== null) {
          const claimants = state.steps.map((step) => step.claimedBy).filter((id) => id !== null)
          expect(claimants, `After ${path.join(' → ')}`).not.toContain('session-b')
        }
      })
      expect(states).toBeGreaterThan(owners.length)
    })

    test('every task not archived is in exactly the one list its rule names', () => {
      explore(owners, (state, path) => {
        const list = listOf(state)
        const matching = (Object.keys(LIST_RULES) as BoardList[]).filter((name) =>
          LIST_RULES[name](state)
        )
        if (state.task.archivedAt !== null) {
          expect(list, `After ${path.join(' → ')}`).toBeNull()
        } else {
          expect(matching, `After ${path.join(' → ')}`).toEqual([list])
        }
      })
    })

    test('canAct is true exactly when the matching transition succeeds', () => {
      explore(owners, (state, path) => {
        const flags = canAct(state)
        for (const [action, apply] of Object.entries(AS_YOU)) {
          expect(flags[action as keyof typeof flags], `${action} after ${path.join(' → ')}`).toBe(
            !isRefusal(apply(state))
          )
        }
      })
    })
  }
)

test(
  'counts are the lengths of Your turn, Working, the queue and To sign off',
  { timeout: EXPLORE_TIMEOUT_MS },
  () => {
    const states: TaskState[] = []
    for (const owners of chains()) {
      explore(owners, (state) => {
        states.push({ ...state, task: { ...state.task, id: states.length + 1 } })
      })
    }
    const lengthOf = (list: BoardList) => states.filter((state) => listOf(state) === list).length
    expect(counts(states)).toEqual({
      yourTurn: lengthOf('yourTurn'),
      working: lengthOf('working'),
      queue: lengthOf('queue'),
      toSignOff: lengthOf('toSignOff'),
    })
    expect(lengthOf('yourTurn')).toBeGreaterThan(0)
  }
)
