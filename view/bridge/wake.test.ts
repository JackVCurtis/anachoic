import type { CallToolResult } from '@modelcontextprotocol/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Acted, ActionResult } from '../../shared/props'
import { createBoardSource, POLL_MS } from './board_source'
import { boardResult, emptyBoardProps } from './testing/board_props'
import { FakeApp } from './testing/fake_app'
import { createYourActions, wakeSentences } from './wake'

const T012 = { displayId: 'T-012' }

function actionResult(acted: Partial<Acted> = {}): CallToolResult {
  const result: ActionResult = {
    ...emptyBoardProps(5),
    acted: {
      task: { id: '12', displayId: 'T-012', title: 'Review the PR' },
      status: 'queue',
      position: 1,
      ...acted,
    },
  }
  return { content: [{ type: 'text', text: 'Done' }], structuredContent: result }
}

function refusal(sentence: string): CallToolResult {
  return { content: [{ type: 'text', text: sentence }], isError: true }
}

/** The texts of every message the app posted. */
function posted(app: FakeApp) {
  return app.calls.sendMessage.map((message) => {
    expect(message.role).toBe('user')
    expect(message.content).toHaveLength(1)
    const [block] = message.content
    expect(block.type).toBe('text')
    return (block as { text: string }).text
  })
}

describe('the sentences', () => {
  test.each([
    [
      'mark your step done',
      wakeSentences.finishedStep('T-012', { number: 2, title: 'Review the PR' }),
      'I finished step 2 of T-012, “Review the PR”.',
    ],
    [
      'mark your step done with a note',
      wakeSentences.finishedStep('T-012', { number: 2, title: 'Review the PR' }, 'Two nits'),
      'I finished step 2 of T-012, “Review the PR”. Note: Two nits',
    ],
    [
      'answer a question',
      wakeSentences.answered('T-012', 2, 'Redis, with a 5 minute TTL'),
      'I answered step 2 of T-012: “Redis, with a 5 minute TTL”',
    ],
    [
      'add a task to the queue',
      wakeSentences.added('T-015', 'Add retries', true),
      'I added T-015, “Add retries”, to the queue.',
    ],
    [
      'add a task to the backlog',
      wakeSentences.added('T-015', 'Add retries', false),
      'I added T-015, “Add retries”, to the backlog.',
    ],
    ['reorder', wakeSentences.moved('T-015', 1), 'I moved T-015 to position 1 in the queue.'],
    ['queue', wakeSentences.queued('T-015', 4), 'I queued T-015 at position 4.'],
    [
      'queue a task whose next step is yours',
      wakeSentences.queuedToYou('T-015'),
      'I queued T-015, and its next step is mine.',
    ],
    ['move to backlog', wakeSentences.movedToBacklog('T-015'), 'I moved T-015 to the backlog.'],
    [
      'move an active task to backlog',
      wakeSentences.parked('T-015'),
      'I parked T-015 and moved it to the backlog.',
    ],
    ['sign off', wakeSentences.signedOff('T-006'), 'I signed off T-006.'],
    [
      'one follow-up step',
      wakeSentences.followedUp('T-006', 1),
      'I added 1 follow-up step to T-006.',
    ],
    [
      'two follow-up steps',
      wakeSentences.followedUp('T-006', 2),
      'I added 2 follow-up steps to T-006.',
    ],
    ['archive', wakeSentences.archived('T-008'), 'I archived T-008.'],
  ])('%s', (_action, sentence, expected) => {
    expect(sentence).toBe(expected)
  })
})

describe('your actions', () => {
  test.each([
    [
      'add_task_from_view',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.addTask({ title: 'Review the PR', steps: [], queue: false }),
      actionResult({ status: 'backlog', position: null }),
      'I added T-012, “Review the PR”, to the backlog.',
    ],
    [
      'queue_task_from_view',
      (actions: ReturnType<typeof createYourActions>) => actions.queueTask(T012),
      actionResult({ position: 4 }),
      'I queued T-012 at position 4.',
    ],
    [
      'queue_task_from_view',
      (actions: ReturnType<typeof createYourActions>) => actions.queueTask(T012),
      actionResult({ status: 'active', position: null }),
      'I queued T-012, and its next step is mine.',
    ],
    [
      'reorder_queue',
      (actions: ReturnType<typeof createYourActions>) => actions.reorderQueue(T012, 9),
      actionResult({ position: 3 }),
      'I moved T-012 to position 3 in the queue.',
    ],
    [
      'move_to_backlog',
      (actions: ReturnType<typeof createYourActions>) => actions.moveToBacklog(T012, false),
      actionResult({ status: 'backlog', position: null }),
      'I moved T-012 to the backlog.',
    ],
    [
      'move_to_backlog',
      (actions: ReturnType<typeof createYourActions>) => actions.moveToBacklog(T012, true),
      actionResult({ status: 'backlog', position: null }),
      'I parked T-012 and moved it to the backlog.',
    ],
    [
      'complete_my_step',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.completeMyStep(T012, { number: 2, title: 'Review the PR' }, 'Two nits'),
      actionResult({ status: 'done', position: null }),
      'I finished step 2 of T-012, “Review the PR”. Note: Two nits',
    ],
    [
      'answer_question',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.answerQuestion(T012, 2, 'In-process'),
      actionResult({ status: 'active', position: null }),
      'I answered step 2 of T-012: “In-process”',
    ],
    [
      'sign_off',
      (actions: ReturnType<typeof createYourActions>) => actions.signOff(T012),
      actionResult({ status: 'done', position: null }),
      'I signed off T-012.',
    ],
    [
      'add_follow_up_from_view',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.addFollowUp(T012, {
          steps: [
            { title: 'Fix', owner: 'agent' },
            { title: 'Check', owner: 'you' },
          ],
          placement: 'first',
        }),
      actionResult(),
      'I added 2 follow-up steps to T-012.',
    ],
    [
      'archive_task',
      (actions: ReturnType<typeof createYourActions>) => actions.archiveTask(T012),
      actionResult({ status: 'backlog', position: null }),
      'I archived T-012.',
    ],
  ])(
    '%s that succeeds posts one sentence after its result',
    async (tool, act, result, sentence) => {
      const app = new FakeApp({ answer: () => result })

      const outcome = await act(createYourActions(app))

      expect(outcome.ok).toBe(true)
      expect(app.calls.callServerTool.map(({ name }) => name)).toEqual([tool])
      expect(posted(app)).toEqual([sentence])
    }
  )

  test('a refused action posts nothing', async () => {
    const app = new FakeApp({ answer: () => refusal('T-012 is active, not done') })

    const outcome = await createYourActions(app).signOff(T012)

    expect(outcome).toEqual({ ok: false, refusal: 'T-012 is active, not done' })
    expect(app.calls.sendMessage).toEqual([])
  })

  test('an action the server never answers posts nothing', async () => {
    const app = new FakeApp({ answer: () => new Error('The host went away') })

    await createYourActions(app).archiveTask(T012)

    expect(app.calls.sendMessage).toEqual([])
  })

  test('a failed post leaves the action’s result as it was', async () => {
    const app = new FakeApp({ answer: () => actionResult() })
    app.sendMessage = () => Promise.reject(new Error('No chat'))

    const outcome = await createYourActions(app).signOff(T012)

    expect(outcome.ok).toBe(true)
  })
})

describe('polling', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('a poll that brings a worker’s change posts nothing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const app = new FakeApp({
      answer: () =>
        boardResult({
          ...emptyBoardProps(6),
          counts: { yourTurn: 0, working: 1, queue: 0, toSignOff: 0 },
        }),
    })
    const source = createBoardSource(app, emptyBoardProps(5))

    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    source.stop()

    expect(source.getSnapshot().board.revision).toBe(6)
    expect(app.calls.sendMessage).toEqual([])
  })
})
