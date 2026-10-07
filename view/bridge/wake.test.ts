import type { CallToolResult } from '@modelcontextprotocol/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Acted, ActionResult } from '../../shared/props'
import { createBoardSource, POLL_MS } from './board_source'
import { boardResult, emptyBoardProps } from './testing/board_props'
import { FakeApp } from './testing/fake_app'
import { createYourActions } from './wake'

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

describe('your actions', () => {
  test.each([
    [
      'add_task_from_view',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.addTask({ title: 'Review the PR', steps: [], queue: false }),
      actionResult({ status: 'backlog', position: null }),
    ],
    [
      'queue_task_from_view',
      (actions: ReturnType<typeof createYourActions>) => actions.queueTask(T012, 'worker-a'),
      actionResult({ position: 4 }),
    ],
    [
      'queue_task_from_view',
      (actions: ReturnType<typeof createYourActions>) => actions.queueTask(T012, null),
      actionResult({ status: 'active', position: null }),
    ],
    [
      'reorder_queue',
      (actions: ReturnType<typeof createYourActions>) => actions.reorderQueue(T012, 9),
      actionResult({ position: 3 }),
    ],
    [
      'move_to_backlog',
      (actions: ReturnType<typeof createYourActions>) => actions.moveToBacklog(T012, false),
      actionResult({ status: 'backlog', position: null }),
    ],
    [
      'move_to_backlog',
      (actions: ReturnType<typeof createYourActions>) => actions.moveToBacklog(T012, true),
      actionResult({ status: 'backlog', position: null }),
    ],
    [
      'complete_my_step',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.completeMyStep(T012, { number: 2, title: 'Review the PR' }, 'Two nits'),
      actionResult({ status: 'done', position: null }),
    ],
    [
      'answer_question',
      (actions: ReturnType<typeof createYourActions>) =>
        actions.answerQuestion(T012, 2, { direct: 'In-process' }),
      actionResult({ status: 'active', position: null }),
    ],
    [
      'sign_off',
      (actions: ReturnType<typeof createYourActions>) => actions.signOff(T012),
      actionResult({ status: 'done', position: null }),
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
    ],
    [
      'archive_task',
      (actions: ReturnType<typeof createYourActions>) => actions.archiveTask(T012),
      actionResult({ status: 'backlog', position: null }),
    ],
  ])('%s that succeeds resolves to its result and posts nothing', async (tool, act, result) => {
    const app = new FakeApp({ answer: () => result })

    const outcome = await act(createYourActions(app))

    expect(outcome).toEqual({ ok: true, props: result.structuredContent })
    expect(app.calls.callServerTool.map(({ name }) => name)).toEqual([tool])
    expect(app.calls.sendMessage).toEqual([])
  })

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
