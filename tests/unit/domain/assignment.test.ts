import { describe, expect, test } from 'vitest'
import { assignmentViolations, checkTask } from '../../../domain/invariants.js'
import {
  add,
  addToQueue,
  archive,
  claim,
  completeStep,
  followUp,
  release,
  unassign,
  type Outcome,
} from '../../../domain/transitions.js'
import type { Owner, Session, TaskState } from '../../../domain/types.js'
import { accepted, at, ctx, refused, stateOf } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'

function assigned(owners: Owner[] = ['agent'], to = A): TaskState {
  return stateOf(
    addToQueue(
      {
        taskId: 12,
        title: 'Task 12',
        steps: owners.map((owner, index) => ({ title: `Step ${index + 1}`, owner })),
        assignTo: to,
      },
      ctx('you')
    )
  )
}

function expectRefusal(outcome: Outcome, code: string, sentence: string) {
  expect(refused(outcome)).toEqual({ code, sentence })
}

function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    kind: 'worker',
    name: id,
    projectDir: null,
    pid: 1,
    firstSeenAt: at(0),
    lastSeenAt: at(0),
    endedAt: null,
    removedAt: null,
    ...overrides,
  }
}

describe('Assigning a task to a worker', () => {
  test('Add and Add to queue record the worker and an assigned event after added', () => {
    const backlog = add(
      { taskId: 12, title: 'Task 12', steps: [{ title: 'Do', owner: 'agent' }], assignTo: A },
      ctx('you')
    )
    expect(backlog.task.assignedTo).toBe(A)
    expect(backlog.events.map((event) => [event.kind, event.detail])).toEqual([
      ['added', 'Added with 1 step'],
      ['assigned', 'Assigned to api-server'],
    ])

    const change = accepted(
      addToQueue(
        { taskId: 13, title: 'Task 13', steps: [{ title: 'Do', owner: 'agent' }], assignTo: A },
        ctx('you')
      )
    )
    expect(change.task).toMatchObject({ status: 'queue', assignedTo: A })
    expect(change.events.map((event) => event.kind)).toEqual(['added', 'assigned', 'queued'])
  })

  test('Unassigned is the default, with no assigned event', () => {
    const change = add(
      { taskId: 12, title: 'Task 12', steps: [{ title: 'Do', owner: 'agent' }] },
      ctx('you')
    )
    expect(change.task.assignedTo).toBeNull()
    expect(change.events.map((event) => event.kind)).toEqual(['added'])
  })

  test('Claim by the assigned worker is allowed', () => {
    const state = stateOf(claim(assigned(), ctx(A, 10)))
    checkTask(state)
    expect(state.steps[0]).toMatchObject({ status: 'running', claimedBy: A })
    expect(state.task.assignedTo).toBe(A)
  })

  test('Claim by another session, the dedicated session included, is refused with not_yours', () => {
    expectRefusal(claim(assigned(), ctx(B, 10)), 'not_yours', 'T-012 is assigned to api-server')
    expectRefusal(
      claim(assigned(), ctx('dedicated', 10)),
      'not_yours',
      'T-012 is assigned to api-server'
    )
  })

  test('A later agent step of an assigned task is the assigned worker’s alone too', () => {
    let state = stateOf(claim(assigned(['agent', 'agent']), ctx(A, 10)))
    state = stateOf(completeStep(state, ctx(A, 20), { summary: 'Did it' }))
    expect(state.task).toMatchObject({ status: 'queue', assignedTo: A })
    expectRefusal(claim(state, ctx(B, 30)), 'not_yours', 'T-012 is assigned to api-server')
    expect(stateOf(claim(state, ctx(A, 30))).steps[1]).toMatchObject({ claimedBy: A })
  })

  test('Unassign clears assignedTo with an unassigned event, and nothing else', () => {
    const before = assigned()
    const change = accepted(unassign(before, ctx(A, 50)))
    expect(change.task).toEqual({ ...before.task, assignedTo: null })
    expect(change.steps).toEqual(before.steps)
    expect(change.queue).toEqual({ kind: 'none' })
    expect(change.events).toEqual([
      {
        taskId: 12,
        stepId: null,
        sessionId: A,
        kind: 'unassigned',
        detail: 'Unassigned: api-server stopped responding',
        at: at(50),
      },
    ])
  })

  test('Unassign refuses a task not assigned to the session', () => {
    expectRefusal(
      unassign(assigned(), ctx(B, 50)),
      'invalid',
      'T-012 is not assigned to web-client'
    )
    const plain = stateOf(
      addToQueue({ taskId: 12, title: 'T', steps: [{ title: 'Do', owner: 'agent' }] }, ctx('you'))
    )
    expect(refused(unassign(plain, ctx(A, 50))).code).toBe('invalid')
  })

  test('Release then unassign leaves an unassigned task at the front of the queue', () => {
    const claimed = stateOf(claim(assigned(), ctx(A, 10)))
    const released = stateOf(release(claimed, ctx(A, 20)))
    const state = stateOf(unassign(released, ctx(A, 20)))
    checkTask(state)
    expect(state.task).toMatchObject({ status: 'queue', assignedTo: null })
    expect(stateOf(claim(state, ctx(B, 30))).steps[0]).toMatchObject({ claimedBy: B })
  })

  test('Archive clears assignedTo', () => {
    expect(stateOf(archive(assigned(), ctx('you', 10))).task.assignedTo).toBeNull()
    const claimed = stateOf(claim(assigned(), ctx(A, 10)))
    expect(stateOf(archive(claimed, ctx('you', 20))).task.assignedTo).toBeNull()
  })

  test('A follow-up keeps the assignment', () => {
    let state = stateOf(claim(assigned(), ctx(A, 10)))
    state = stateOf(completeStep(state, ctx(A, 20), { summary: 'Did it' }))
    expect(state.task.status).toBe('done')
    state = stateOf(
      followUp(state, ctx('you', 30), {
        placement: 'last',
        steps: [{ title: 'More', owner: 'agent' }],
      })
    )
    expect(state.task).toMatchObject({ status: 'queue', assignedTo: A })
    expectRefusal(claim(state, ctx(B, 40)), 'not_yours', 'T-012 is assigned to api-server')
  })
})

describe('The assignment invariant', () => {
  test('holds when assignedTo names a worker whose endedAt is empty', () => {
    expect(assignmentViolations([assigned()], [session(A)])).toEqual([])
  })

  test('is broken by an ended worker, the dedicated session and an unknown session', () => {
    expect(assignmentViolations([assigned()], [session(A, { endedAt: at(5) })])).toEqual([
      'T-012: assigned: assigned to a session that ended, session-a',
    ])
    expect(
      assignmentViolations(
        [assigned(['agent'], 'dedicated')],
        [session('dedicated', { kind: 'dedicated' })]
      )
    ).toEqual(['T-012: assigned: assigned to the dedicated session, dedicated'])
    expect(assignmentViolations([assigned()], [])).toEqual([
      'T-012: assigned: assigned to an unknown session, session-a',
    ])
  })
})
