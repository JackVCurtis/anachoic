import { describe, expect, test } from 'vitest'
import { currentStep } from '../../../domain/chain.js'
import { checkTask } from '../../../domain/invariants.js'
import {
  addToQueue,
  answer,
  archive,
  ask,
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
  unqueue,
  type Outcome,
} from '../../../domain/transitions.js'
import type { Owner, TaskState } from '../../../domain/types.js'
import { accepted, at, backlogTask, ctx, refused, stateOf } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'

function queued(owners: Owner[]) {
  return stateOf(queue(backlogTask(owners), ctx(A)))
}

function claimedBy(owners: Owner[], session = A, seconds = 10) {
  return stateOf(claim(queued(owners), ctx(session, seconds)))
}

function asked(owners: Owner[], seconds = 20) {
  return stateOf(ask(claimedBy(owners), ctx(A, seconds), 'Redis or in-process?'))
}

function done(owners: Owner[] = ['agent']): TaskState {
  let state = claimedBy(owners)
  while (state.task.status !== 'done') {
    const step = currentStep(state.steps)
    state =
      step.owner === 'you'
        ? stateOf(completeMyStep(state, ctx('you', 30)))
        : step.status === 'pending'
          ? stateOf(claim(state, ctx(A, 30)))
          : stateOf(completeStep(state, ctx(A, 30), { summary: 'Did it' }))
  }
  return state
}

function signed(): TaskState {
  return stateOf(signOff(done(), ctx('you', 40)))
}

function archivedTask(): TaskState {
  return stateOf(archive(backlogTask(['agent']), ctx('you', 5)))
}

function expectRefusal(outcome: Outcome, code: string, sentence: string) {
  const refusal = refused(outcome)
  expect(refusal).toEqual({ code, sentence })
}

describe('The task state machine', () => {
  test('Add creates a backlog task with every step pending', () => {
    const state = backlogTask(['agent', 'you'])
    checkTask(state)
    expect(state.task).toMatchObject({ status: 'backlog', createdBy: 'you', queuePosition: null })
    expect(state.steps.map((step) => [step.id, step.status, step.origin])).toEqual([
      ['12.1', 'pending', 'chain'],
      ['12.2', 'pending', 'chain'],
    ])
  })

  test('Add records the session that added the task', () => {
    expect(backlogTask(['agent'], 3, A).task.createdBy).toBe(A)
  })

  test('Add to queue joins the back of the queue when the first step is an agent’s', () => {
    const change = addToQueue(
      { taskId: 12, title: 'Add retries', steps: [{ title: 'Write it', owner: 'agent' }] },
      ctx(A)
    )
    expect(change.task.status).toBe('queue')
    expect(change.queue).toEqual({ kind: 'join', placement: 'last' })
    expect(change.events.map((event) => event.kind)).toEqual(['added', 'queued'])
  })

  test("Add to queue starts the task at once when the first step is the user's", () => {
    const change = addToQueue(
      { taskId: 12, title: 'Review', steps: [{ title: 'Read it', owner: 'you' }] },
      ctx(A, 5)
    )
    checkTask(change)
    expect(change.task.status).toBe('active')
    expect(change.steps[0]).toMatchObject({
      status: 'waiting',
      waitingSince: at(5),
      startedAt: at(5),
    })
    expect(change.queue).toEqual({ kind: 'none' })
    expect(change.events.map((event) => event.kind)).toEqual(['added', 'started'])
  })

  test('Queue sends a backlog task to the back of the queue', () => {
    const change = accepted(queue(backlogTask(['agent']), ctx('you')))
    expect(change.task.status).toBe('queue')
    expect(change.queue).toEqual({ kind: 'join', placement: 'last' })
  })

  test("Queue starts the task when its current step is the user's", () => {
    const change = accepted(queue(backlogTask(['you', 'agent']), ctx(A)))
    expect(change.task.status).toBe('active')
    expect(change.steps[0].status).toBe('waiting')
    expect(change.queue).toEqual({ kind: 'none' })
  })

  test('Queue refuses a task in the queue', () => {
    expectRefusal(
      queue(queued(['agent']), ctx('you')),
      'wrong_status',
      'T-012 is in the queue, not in the backlog'
    )
  })

  test('Unqueue moves a queued task to the backlog and leaves the queue', () => {
    const change = accepted(unqueue(queued(['agent']), ctx('you')))
    checkTask(change)
    expect(change.task.status).toBe('backlog')
    expect(change.queue).toEqual({ kind: 'leave' })
  })

  test("Unqueue is the user's alone, and starts from the queue", () => {
    expectRefusal(
      unqueue(queued(['agent']), ctx(A)),
      'not_yours',
      'Only the user can move T-012 to the backlog'
    )
    expectRefusal(
      unqueue(backlogTask(['agent']), ctx('you')),
      'wrong_status',
      'T-012 is in the backlog, not in the queue'
    )
  })

  test('Reorder moves a queued task to the position given', () => {
    const change = accepted(reorder(queued(['agent']), ctx('you'), 3))
    expect(change.queue).toEqual({ kind: 'move', position: 3 })
    expect(change.events.map((event) => event.kind)).toEqual(['reordered'])
  })

  test('Reorder refuses a session, a backlog task and a position below 1', () => {
    expectRefusal(
      reorder(queued(['agent']), ctx(A), 1),
      'not_yours',
      'Only the user can reorder T-012'
    )
    expectRefusal(
      reorder(backlogTask(['agent']), ctx('you'), 1),
      'wrong_status',
      'T-012 is in the backlog, not in the queue'
    )
    expect(refused(reorder(queued(['agent']), ctx('you'), 0)).code).toBe('invalid')
  })

  test('Claim makes the current agent step running and leaves the queue', () => {
    const change = accepted(claim(queued(['agent', 'you']), ctx(A, 10)))
    checkTask(change)
    expect(change.task.status).toBe('active')
    expect(change.steps[0]).toMatchObject({
      status: 'running',
      claimedBy: A,
      runningSince: at(10),
      startedAt: at(10),
    })
    expect(change.queue).toEqual({ kind: 'leave' })
    expect(change.events[0]).toMatchObject({
      kind: 'claimed',
      sessionId: A,
      stepId: '12.1',
      detail: 'Claimed by api-server',
    })
  })

  test('The dedicated session can claim', () => {
    expect(accepted(claim(queued(['agent']), ctx('dedicated'))).steps[0].claimedBy).toBe(
      'dedicated'
    )
  })

  test('Claim refuses you and a task not in the queue', () => {
    expectRefusal(
      claim(queued(['agent']), ctx('you')),
      'not_yours',
      'Only a session can claim a step of T-012'
    )
    expectRefusal(
      claim(backlogTask(['agent']), ctx(A)),
      'wrong_status',
      'T-012 is in the backlog, not in the queue'
    )
    expectRefusal(
      claim(claimedBy(['agent']), ctx(B)),
      'wrong_status',
      'T-012 is active, not in the queue'
    )
  })

  test('Start, for your step, refuses an agent step', () => {
    expectRefusal(
      start(backlogTask(['agent']), ctx('you')),
      'not_yours',
      "Step 1 of T-012 is an agent's, not the user's"
    )
    expect(accepted(start(backlogTask(['you']), ctx('you'))).task.status).toBe('active')
  })

  describe('Complete the current step', () => {
    test('with no next step, the task is done with finishedAt', () => {
      const change = accepted(completeStep(claimedBy(['agent']), ctx(A, 70), { summary: 'Done' }))
      checkTask(change)
      expect(change.task).toMatchObject({ status: 'done', finishedAt: at(70) })
      expect(change.steps[0]).toMatchObject({
        status: 'done',
        claimedBy: null,
        summary: 'Done',
        finishedAt: at(70),
      })
      expect(change.queue).toEqual({ kind: 'none' })
    })

    test('with a next agent step, the task joins the front of the queue and the step stays pending', () => {
      const change = accepted(
        completeStep(claimedBy(['agent', 'agent']), ctx(A, 70), { summary: 'Done' })
      )
      checkTask(change)
      expect(change.task.status).toBe('queue')
      expect(change.steps[1].status).toBe('pending')
      expect(change.queue).toEqual({ kind: 'join', placement: 'first' })
      expect(change.events.map((event) => event.kind)).toEqual(['completed', 'queued'])
    })

    test('with your next step, the task stays active with no queue effect and your step waits', () => {
      const change = accepted(
        completeStep(claimedBy(['agent', 'you']), ctx(A, 70), { summary: 'Done' })
      )
      checkTask(change)
      expect(change.task.status).toBe('active')
      expect(change.steps[1]).toMatchObject({ status: 'waiting', waitingSince: at(70) })
      expect(change.queue).toEqual({ kind: 'none' })
      expect(change.events.map((event) => event.kind)).toEqual(['completed', 'started'])
    })

    test('you mark your step done, with a note, and the chain moves on', () => {
      const state = stateOf(queue(backlogTask(['you', 'agent']), ctx('you', 0)))
      const change = accepted(completeMyStep(state, ctx('you', 90), { note: 'Looks good' }))
      checkTask(change)
      expect(change.steps[0]).toMatchObject({
        status: 'done',
        note: 'Looks good',
        elapsedSeconds: 90,
      })
      expect(change.task.status).toBe('queue')
      expect(change.queue).toEqual({ kind: 'join', placement: 'first' })
    })

    test('an agent step waiting on you cannot be completed', () => {
      expectRefusal(
        completeStep(asked(['agent']), ctx(A, 30), { summary: 'x' }),
        'unanswered',
        "Step 1 of T-012 is waiting for the user's answer"
      )
    })

    test('another session cannot complete the step', () => {
      expectRefusal(
        completeStep(claimedBy(['agent']), ctx(B), { summary: 'x' }),
        'not_yours',
        'Step 1 of T-012 is claimed by api-server'
      )
    })

    test('a session cannot complete your step, and you cannot complete an agent’s', () => {
      const yours = stateOf(queue(backlogTask(['you']), ctx('you')))
      expectRefusal(
        completeStep(yours, ctx(A), { summary: 'x' }),
        'not_yours',
        "Step 1 of T-012 is the user's, not an agent's"
      )
      expectRefusal(
        completeMyStep(claimedBy(['agent']), ctx('you')),
        'not_yours',
        "Step 1 of T-012 is an agent's, not the user's"
      )
      expectRefusal(
        completeMyStep(yours, ctx(A)),
        'not_yours',
        "Only the user can mark the user's step on T-012 done"
      )
    })

    test('an agent step waiting on you is never marked done by you', () => {
      expectRefusal(
        completeMyStep(asked(['agent']), ctx('you')),
        'not_yours',
        "Step 1 of T-012 is an agent's, not the user's"
      )
    })
  })

  test('Park returns the current step to pending, clears the claim and question, and sends the task to the backlog', () => {
    const change = accepted(park(asked(['agent', 'you']), ctx('you', 50)))
    checkTask(change)
    expect(change.task.status).toBe('backlog')
    expect(change.steps[0]).toMatchObject({
      status: 'pending',
      claimedBy: null,
      question: null,
      answer: null,
      runningSince: null,
      waitingSince: null,
    })
    expect(change.queue).toEqual({ kind: 'none' })
  })

  test("Park is the user's alone and starts from active", () => {
    expectRefusal(park(claimedBy(['agent']), ctx(A)), 'not_yours', 'Only the user can park T-012')
    expectRefusal(
      park(queued(['agent']), ctx('you')),
      'wrong_status',
      'T-012 is in the queue, not active'
    )
  })

  test('move_to_backlog parks an active task and unqueues a queued one', () => {
    expect(accepted(moveToBacklog(claimedBy(['agent']), ctx('you'))).events[0].kind).toBe('parked')
    expect(accepted(moveToBacklog(queued(['agent']), ctx('you'))).queue).toEqual({ kind: 'leave' })
    expectRefusal(
      moveToBacklog(backlogTask(['agent']), ctx('you')),
      'wrong_status',
      'T-012 is in the backlog, not in the queue or active'
    )
  })

  test('Release returns the step to pending and the task to the front of the queue', () => {
    const change = accepted(release(asked(['agent']), ctx(A, 200)))
    checkTask(change)
    expect(change.task.status).toBe('queue')
    expect(change.steps[0]).toMatchObject({ status: 'pending', claimedBy: null, question: null })
    expect(change.queue).toEqual({ kind: 'join', placement: 'first' })
    expect(change.events[0]).toMatchObject({
      kind: 'released',
      sessionId: A,
      detail: 'Released: api-server stopped responding',
    })
  })

  test('Release refuses a session that does not hold the step', () => {
    expect(refused(release(claimedBy(['agent']), ctx(B))).code).toBe('wrong_status')
  })

  test('Sign off sets signedOffAt on a done task', () => {
    const change = accepted(signOff(done(), ctx('you', 99)))
    checkTask(change)
    expect(change.task.signedOffAt).toBe(at(99))
  })

  test('Sign off refuses a task not done, a signed-off task and a session', () => {
    expectRefusal(
      signOff(queued(['agent']), ctx('you')),
      'wrong_status',
      'T-012 is in the queue, not done'
    )
    expectRefusal(signOff(signed(), ctx('you')), 'signed_off', 'T-012 is signed off')
    expectRefusal(signOff(done(), ctx(A)), 'not_yours', 'Only the user can sign off T-012')
  })

  test.each(['first', 'last'] as const)(
    'Follow-up appends steps and joins the queue %s',
    (placement) => {
      const change = accepted(
        followUp(done(['agent']), ctx(A, 80), {
          placement,
          steps: [
            { title: 'More', owner: 'agent' },
            { title: 'Check', owner: 'you' },
          ],
        })
      )
      checkTask(change)
      expect(change.task).toMatchObject({ status: 'queue', finishedAt: null })
      expect(change.steps.slice(1).map((step) => [step.id, step.origin, step.status])).toEqual([
        ['12.2', 'follow_up', 'pending'],
        ['12.3', 'follow_up', 'pending'],
      ])
      expect(change.queue).toEqual({ kind: 'join', placement })
      expect(change.events.map((event) => event.kind)).toEqual(['followed_up', 'queued'])
    }
  )

  test("Follow-up starts at once when the first new step is the user's", () => {
    const change = accepted(
      followUp(done(), ctx('you', 80), {
        placement: 'first',
        steps: [{ title: 'Check', owner: 'you' }],
      })
    )
    checkTask(change)
    expect(change.task.status).toBe('active')
    expect(change.steps[1].status).toBe('waiting')
    expect(change.queue).toEqual({ kind: 'none' })
  })

  test('Follow-up refuses a signed-off task and a task not done', () => {
    const steps = [{ title: 'More', owner: 'agent' as const }]
    expectRefusal(
      followUp(signed(), ctx('you'), { placement: 'last', steps }),
      'signed_off',
      'T-012 is signed off'
    )
    expectRefusal(
      followUp(queued(['agent']), ctx('you'), { placement: 'last', steps }),
      'wrong_status',
      'T-012 is in the queue, not done'
    )
  })

  test.each([
    ['in the backlog', () => backlogTask(['agent']), { kind: 'none' }],
    ['in the queue', () => queued(['agent']), { kind: 'leave' }],
    ['waiting on your answer', () => asked(['agent']), { kind: 'none' }],
    ['done', () => done(), { kind: 'none' }],
  ])(
    'Archive a task %s: status unchanged, claim cleared, out of the queue',
    (_label, make, effect) => {
      const before = make()
      const change = accepted(archive(before, ctx('you', 60)))
      expect(change.task).toMatchObject({ status: before.task.status, archivedAt: at(60) })
      expect(change.steps.every((step) => step.claimedBy === null && step.question === null)).toBe(
        true
      )
      expect(change.queue).toEqual(effect)
      checkTask(change)
    }
  )

  test('Archive refuses a signed-off task and a session', () => {
    expectRefusal(archive(signed(), ctx('you')), 'signed_off', 'T-012 is signed off')
    expectRefusal(
      archive(backlogTask(['agent']), ctx(A)),
      'not_yours',
      'Only the user can archive T-012'
    )
  })

  test.each([
    ['queue', (s: TaskState) => queue(s, ctx('you'))],
    ['unqueue', (s: TaskState) => unqueue(s, ctx('you'))],
    ['reorder', (s: TaskState) => reorder(s, ctx('you'), 1)],
    ['claim', (s: TaskState) => claim(s, ctx(A))],
    ['start', (s: TaskState) => start(s, ctx('you'))],
    ['note', (s: TaskState) => note(s, ctx(A), { note: 'x' })],
    ['ask', (s: TaskState) => ask(s, ctx(A), 'x')],
    ['answer', (s: TaskState) => answer(s, ctx('you'), 'x')],
    ['completeStep', (s: TaskState) => completeStep(s, ctx(A), { summary: 'x' })],
    ['completeMyStep', (s: TaskState) => completeMyStep(s, ctx('you'))],
    ['park', (s: TaskState) => park(s, ctx('you'))],
    ['moveToBacklog', (s: TaskState) => moveToBacklog(s, ctx('you'))],
    ['release', (s: TaskState) => release(s, ctx(A))],
    ['signOff', (s: TaskState) => signOff(s, ctx('you'))],
    [
      'followUp',
      (s: TaskState) =>
        followUp(s, ctx('you'), { placement: 'last', steps: [{ title: 'x', owner: 'agent' }] }),
    ],
    ['archive', (s: TaskState) => archive(s, ctx('you'))],
  ])('%s refuses an archived task', (_name, apply) => {
    expectRefusal(apply(archivedTask()), 'archived', 'T-012 was archived')
  })
})

describe('The step state machine', () => {
  test('pending to running: a session claims the agent step', () => {
    expect(claimedBy(['agent']).steps[0].status).toBe('running')
  })

  test('pending to waiting: your step becomes current on an active task', () => {
    const state = claimedBy(['agent', 'you'])
    expect(accepted(completeStep(state, ctx(A, 20), { summary: 'x' })).steps[1].status).toBe(
      'waiting'
    )
  })

  test('running to waiting: ask_you stores the question and clears any old answer', () => {
    const state = asked(['agent'])
    checkTask(state)
    expect(state.steps[0]).toMatchObject({
      status: 'waiting',
      question: 'Redis or in-process?',
      answer: null,
      waitingSince: at(20),
      runningSince: null,
    })
  })

  test('ask_you refuses a step already waiting', () => {
    expectRefusal(
      ask(asked(['agent']), ctx(A), 'Again?'),
      'unanswered',
      "Step 1 of T-012 is waiting for the user's answer"
    )
  })

  test('waiting to running: you answer, the answer is stored and the question cleared', () => {
    const change = accepted(answer(asked(['agent']), ctx('you', 50), 'Redis'))
    checkTask(change)
    expect(change.steps[0]).toMatchObject({
      status: 'running',
      answer: 'Redis',
      question: null,
      runningSince: at(50),
    })
    expect(change.events[0]).toMatchObject({ kind: 'answered', sessionId: 'you' })
  })

  test('answer refuses your step, a running step and a session', () => {
    const yours = stateOf(queue(backlogTask(['you']), ctx('you')))
    expectRefusal(
      answer(yours, ctx('you'), 'x'),
      'wrong_status',
      "Step 1 of T-012 is the user's step, not a question"
    )
    expectRefusal(
      answer(claimedBy(['agent']), ctx('you'), 'x'),
      'wrong_status',
      'Step 1 of T-012 is not waiting for an answer'
    )
    expectRefusal(
      answer(asked(['agent']), ctx(A), 'x'),
      'not_yours',
      'Only the user can answer the question on T-012'
    )
  })

  test('running to done: the claiming session completes it', () => {
    expect(
      accepted(completeStep(claimedBy(['agent']), ctx(A), { summary: 'x' })).steps[0].status
    ).toBe('done')
  })

  test('a done step never changes again: completing a done task is refused', () => {
    expectRefusal(
      completeStep(done(), ctx(A), { summary: 'x' }),
      'wrong_status',
      'T-012 is done, not active. Every step is done.'
    )
  })

  test('note records a progress note and links on the held step', () => {
    const links = [{ label: 'PR', url: 'https://example.com/pr/1' }]
    const change = accepted(note(claimedBy(['agent']), ctx(A), { note: 'Halfway', links }))
    expect(change.steps[0]).toMatchObject({ note: 'Halfway', links })
    expect(change.events[0]).toMatchObject({ kind: 'noted', detail: 'Halfway' })
  })

  test('worker calls on a step whose claim ended say why', () => {
    const parked = stateOf(park(claimedBy(['agent']), ctx('you', 30)))
    expectRefusal(
      note(parked, ctx(A), { note: 'x' }),
      'wrong_status',
      'T-012 is in the backlog, not active. It was parked. Stop work on it.'
    )
    const released = stateOf(release(claimedBy(['agent']), ctx(A, 30)))
    expect(refused(note(released, ctx(A), { note: 'x' })).sentence).toContain(
      'Your claim on it has ended'
    )
    const taken = stateOf(claim(released, ctx(B, 40)))
    expectRefusal(
      note(taken, ctx(A), { note: 'x' }),
      'not_yours',
      'Step 1 of T-012 is claimed by web-client'
    )
  })
})

describe('Time on a step', () => {
  test('running time closes into elapsedSeconds and waiting time into waitedSeconds on an agent step', () => {
    let state = claimedBy(['agent'], A, 10)
    state = stateOf(ask(state, ctx(A, 70), 'Q?'))
    state = stateOf(answer(state, ctx('you', 190), 'A'))
    state = stateOf(completeStep(state, ctx(A, 200), { summary: 'S' }))
    expect(state.steps[0]).toMatchObject({ elapsedSeconds: 70, waitedSeconds: 120 })
  })

  test('a park and later restart of your step does not count backlog time', () => {
    let state = stateOf(queue(backlogTask(['you']), ctx('you', 0)))
    state = stateOf(park(state, ctx('you', 30)))
    state = stateOf(queue(state, ctx('you', 1000)))
    expect(state.steps[0]).toMatchObject({
      status: 'waiting',
      waitingSince: at(1000),
      startedAt: at(0),
    })
    state = stateOf(completeMyStep(state, ctx('you', 1015)))
    expect(state.steps[0].elapsedSeconds).toBe(45)
  })

  test('a park of an agent question counts its wait in waitedSeconds', () => {
    const state = stateOf(park(asked(['agent'], 20), ctx('you', 80)))
    expect(state.steps[0]).toMatchObject({ elapsedSeconds: 10, waitedSeconds: 60 })
  })
})
