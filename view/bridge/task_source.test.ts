import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BACKOFF_MS, POLL_MS } from './board_source'
import { createTaskSource, openTaskSource } from './task_source'
import { FakeApp, type ToolAnswer } from './testing/fake_app'
import { refusedResult, taskProps, taskResult } from './testing/task_props'
import { getTask } from './tools'

/**
 * A fake App whose get_task gives the queued answers in turn, and then says
 * the board has not changed since the revision asked about.
 */
function queuedApp(...answers: Array<ReturnType<ToolAnswer>>) {
  const queue = [...answers]
  return new FakeApp({
    answer: (params) =>
      queue.length > 0
        ? queue.shift()!
        : taskResult({
            changed: false,
            revision: (params.arguments?.sinceRevision as number | undefined) ?? 0,
          }),
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getTask', () => {
  test('sends the task, and sinceRevision only when given', async () => {
    const app = queuedApp(taskResult(taskProps(3)))

    expect(await getTask(app, 'T-012')).toEqual({ ok: true, props: taskProps(3) })
    await getTask(app, 12, 3)

    expect(app.calls.callServerTool).toEqual([
      { name: 'get_task', arguments: { task: 'T-012' } },
      { name: 'get_task', arguments: { task: 12, sinceRevision: 3 } },
    ])
  })
})

describe('the task source', () => {
  test('opens on the fetched task, then polls with its revision and redraws only on a newer one', async () => {
    const app = queuedApp(taskResult(taskProps(3)))
    const source = await openTaskSource(app, '12')
    const opened = source.getSnapshot()
    expect(opened).toEqual({ task: taskProps(3), refusal: null, unreachable: false })

    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(app.callsTo('get_task').at(-1)?.arguments).toEqual({ task: '12', sinceRevision: 3 })
    expect(source.getSnapshot()).toBe(opened)

    source.stop()

    const listener = vi.fn()
    const later = queuedApp(taskResult(taskProps(5)))
    const live = createTaskSource(later, '12', { task: taskProps(3) })
    live.subscribe(listener)
    live.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(live.getSnapshot().task?.revision).toBe(5)
    expect(listener).toHaveBeenCalledTimes(1)
    live.stop()
  })

  test('opens on a refusal at once, and shows the refusal a poll gives in place of the task', async () => {
    const missing = await openTaskSource(queuedApp(refusedResult('T-012 does not exist')), 'T-012')
    expect(missing.getSnapshot()).toEqual({
      task: null,
      refusal: 'T-012 does not exist',
      unreachable: false,
    })

    const app = queuedApp(refusedResult('T-012 was archived'), taskResult(taskProps(9)))
    const source = createTaskSource(app, 'T-012', { task: taskProps(3) })
    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(source.getSnapshot()).toMatchObject({ refusal: 'T-012 was archived' })

    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0])
    // After a refusal the task is fetched in full.
    expect(app.callsTo('get_task').at(-1)?.arguments).toEqual({ task: 'T-012' })
    expect(source.getSnapshot()).toEqual({ task: taskProps(9), refusal: null, unreachable: false })
    source.stop()
  })

  test('backs off while unreachable, and recovers', async () => {
    const app = queuedApp(new Error('Gone'), new Error('Gone'))
    const source = createTaskSource(app, 'T-012', { task: taskProps(3) })
    source.start()

    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(source.getSnapshot().unreachable).toBe(true)
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0] - 1)
    expect(app.callsTo('get_task')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(app.callsTo('get_task')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[1])
    expect(source.getSnapshot().unreachable).toBe(false)
    source.stop()
  })

  test('refresh fetches at once and restarts the poll timer', async () => {
    const app = queuedApp(taskResult(taskProps(4)))
    const source = createTaskSource(app, 'T-012', { task: taskProps(3) })
    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS - 1)
    await source.refresh()
    expect(source.getSnapshot().task?.revision).toBe(4)
    await vi.advanceTimersByTimeAsync(POLL_MS - 1)
    expect(app.callsTo('get_task')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(app.callsTo('get_task')).toHaveLength(2)
    source.stop()
  })
})
