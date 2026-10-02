import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BACKOFF_MS, POLL_MS } from './board_source'
import { createHistorySource, openHistorySource } from './history_source'
import { FakeApp, type ToolAnswer } from './testing/fake_app'
import { historyProps, historyResult } from './testing/history_props'
import { refusedResult } from './testing/task_props'
import { getHistory } from './tools'

/**
 * A fake App whose get_history gives the queued answers in turn, and then
 * says the board has not changed since the revision asked about.
 */
function queuedApp(...answers: Array<ReturnType<ToolAnswer>>) {
  const queue = [...answers]
  return new FakeApp({
    answer: (params) =>
      queue.length > 0
        ? queue.shift()!
        : historyResult({
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

describe('getHistory', () => {
  test('sends the page, and the filter and sinceRevision only when given', async () => {
    const app = queuedApp(historyResult(historyProps(3)))

    expect(await getHistory(app, 1)).toEqual({ ok: true, props: historyProps(3) })
    await getHistory(app, 2, 'login', 3)
    await getHistory(app, 1, '')

    expect(app.calls.callServerTool).toEqual([
      { name: 'get_history', arguments: { page: 1 } },
      { name: 'get_history', arguments: { page: 2, filter: 'login', sinceRevision: 3 } },
      { name: 'get_history', arguments: { page: 1 } },
    ])
  })
})

describe('the history source', () => {
  test('opens on the fetched page, then polls with its revision and redraws only on a newer one', async () => {
    const app = queuedApp(historyResult(historyProps(3)))
    const source = await openHistorySource(app)
    const opened = source.getSnapshot()
    expect(opened).toEqual({ history: historyProps(3), refusal: null, unreachable: false })

    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 1, sinceRevision: 3 })
    expect(source.getSnapshot()).toBe(opened)
    source.stop()

    const listener = vi.fn()
    const later = queuedApp(historyResult(historyProps(5)))
    const live = createHistorySource(later, { history: historyProps(3) })
    live.subscribe(listener)
    live.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(live.getSnapshot().history?.revision).toBe(5)
    expect(listener).toHaveBeenCalledTimes(1)
    live.stop()
  })

  test('show fetches another page or filter in full at once, at the same revision, and polls it', async () => {
    const app = queuedApp(
      historyResult(historyProps(3, 2)),
      historyResult(historyProps(3, 1, 'cach'))
    )
    const source = createHistorySource(app, { history: historyProps(3) })
    source.start()

    await source.show({ page: 2 })
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 2 })
    expect(source.getSnapshot().history?.page).toBe(2)

    await source.show({ page: 1, filter: ' cach ' })
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 1, filter: 'cach' })
    expect(source.getSnapshot().history).toEqual(historyProps(3, 1, 'cach'))

    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({
      page: 1,
      filter: 'cach',
      sinceRevision: 3,
    })
    source.stop()
  })

  test('a page past the end comes back as the last page, which later polls ask for', async () => {
    const app = queuedApp(historyResult(historyProps(3, 2)))
    const source = createHistorySource(app, { history: historyProps(3) })
    source.start()

    await source.show({ page: 9 })
    expect(source.getSnapshot().history?.page).toBe(2)
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 2, sinceRevision: 3 })
    source.stop()
  })

  test('a poll for a page asked for before another was shown is never drawn', async () => {
    let answerFirst: (result: ReturnType<typeof historyResult>) => void = () => {}
    let calls = 0
    const app = new FakeApp({
      answer: () => {
        calls += 1
        if (calls === 1) {
          return new Promise((resolve) => {
            answerFirst = resolve
          })
        }
        return historyResult(historyProps(4, 2))
      },
    })
    const source = createHistorySource(app, { history: historyProps(3) })

    const refreshing = source.refresh()
    await source.show({ page: 2 })
    answerFirst(historyResult(historyProps(5, 1)))
    await refreshing

    expect(source.getSnapshot().history).toEqual(historyProps(4, 2))
  })

  test('shows a refusal, backs off while unreachable, and recovers', async () => {
    const app = queuedApp(
      refusedResult('Something went wrong. Details are in the server log.'),
      new Error('Gone'),
      historyResult(historyProps(9))
    )
    const source = createHistorySource(app, { history: historyProps(3) })
    source.start()

    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(source.getSnapshot()).toMatchObject({
      refusal: 'Something went wrong. Details are in the server log.',
    })
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0])
    // After a refusal the page is fetched in full.
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 1 })
    expect(source.getSnapshot().unreachable).toBe(true)
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[1])
    expect(source.getSnapshot()).toEqual({
      history: historyProps(9),
      refusal: null,
      unreachable: false,
    })
    source.stop()
  })

  test('a refresh in flight when the source starts still shows its refusal', async () => {
    let answer: (result: ReturnType<typeof refusedResult>) => void = () => {}
    const app = new FakeApp({
      answer: () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    })
    const source = createHistorySource(app, { history: historyProps(3) })

    const refreshing = source.refresh()
    source.start()
    answer(refusedResult('Something went wrong. Details are in the server log.'))
    await refreshing

    expect(source.getSnapshot()).toMatchObject({
      refusal: 'Something went wrong. Details are in the server log.',
    })
    source.stop()
  })

  test('opens on a refusal at once, and keeps asking for the page it was given', async () => {
    const app = queuedApp(refusedResult('Something went wrong.'), historyResult(historyProps(2, 2)))
    const source = await openHistorySource(app, { page: 2, filter: 'cach' })
    expect(source.getSnapshot()).toEqual({
      history: null,
      refusal: 'Something went wrong.',
      unreachable: false,
    })
    await source.refresh()
    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 2, filter: 'cach' })
  })
})
