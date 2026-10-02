import type { CallToolResult } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { BoardProps, YourTurnItem } from '../../shared/props'
import {
  BACKOFF_MS,
  createBoardSource,
  openBoardSource,
  POLL_MS,
  type BoardSource,
} from './board_source'
import { boardResult, emptyBoardProps } from './testing/board_props'
import { FakeApp, type ToolAnswer } from './testing/fake_app'

const START = new Date('2026-03-12T09:41:00.000Z')

function unchanged(revision: number): CallToolResult {
  return boardResult({ changed: false, revision })
}

function yourStep(id: string, title: string): YourTurnItem {
  return {
    task: { id, displayId: `T-${id}`, title },
    step: { number: 1, title: 'Review', owner: 'you', waitingSince: START.toISOString() },
    steps: [],
    canAct: { complete: true, park: true },
  }
}

function board(revision: number, change: Partial<BoardProps> = {}): BoardProps {
  return { ...emptyBoardProps(revision), ...change }
}

/**
 * A fake App whose get_board gives the queued answers in turn, and then says
 * the board has not changed since the revision asked about.
 */
function queuedApp(...answers: Array<ReturnType<ToolAnswer>>) {
  const queue = [...answers]
  return new FakeApp({
    answer: (params) =>
      queue.length > 0
        ? queue.shift()!
        : unchanged((params.arguments?.sinceRevision as number | undefined) ?? 0),
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers({ now: START, toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the board source', () => {
  test('fetches the board without a revision', async () => {
    const app = queuedApp(boardResult(board(4)))
    const source = await openBoardSource(app)

    expect(app.calls.callServerTool).toEqual([{ name: 'get_board', arguments: {} }])
    expect(source.getSnapshot().board.revision).toBe(4)
  })

  test('tries the first fetch again after the backoff waits until get_board returns the board', async () => {
    const app = queuedApp(new Error('Gone'), unchanged(4), new Error('Gone'), boardResult(board(5)))
    let opened: BoardSource | null = null
    void openBoardSource(app).then((source) => {
      opened = source
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(app.calls.callServerTool).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0])
    expect(app.calls.callServerTool).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[1])
    expect(app.calls.callServerTool).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[2] - 1)
    expect(app.calls.callServerTool).toHaveLength(3)
    expect(opened).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(app.calls.callServerTool).toHaveLength(4)
    expect(opened!.getSnapshot().board.revision).toBe(5)
  })

  test('polls with the revision drawn every 3 s once started, and not after it stops', async () => {
    const app = queuedApp()
    const source = createBoardSource(app, board(4))

    await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    expect(app.calls.callServerTool).toHaveLength(0)

    source.start()
    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS - 1)
    expect(app.calls.callServerTool).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(app.calls.callServerTool).toEqual([
      { name: 'get_board', arguments: { sinceRevision: 4 } },
    ])
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(app.calls.callServerTool).toHaveLength(2)

    source.stop()
    await vi.advanceTimersByTimeAsync(POLL_MS * 5)
    expect(app.calls.callServerTool).toHaveLength(2)
  })

  test('an unchanged board keeps the snapshot and tells no one', async () => {
    const source = createBoardSource(queuedApp(), board(4))
    const listener = vi.fn()
    source.subscribe(listener)
    const before = source.getSnapshot()

    source.start()
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)

    expect(listener).not.toHaveBeenCalled()
    expect(source.getSnapshot()).toBe(before)
  })

  test('a newer board replaces the one drawn and is marked updated; an older or equal one is ignored', async () => {
    const app = queuedApp(
      boardResult(board(5)),
      boardResult(board(5)),
      boardResult(board(3)),
      unchanged(5)
    )
    const source = createBoardSource(app, board(4))
    source.start()

    await vi.advanceTimersByTimeAsync(POLL_MS)
    const updated = source.getSnapshot()
    expect(updated.board.revision).toBe(5)
    expect(updated.updatedAt).toBe(new Date(START.getTime() + POLL_MS).toISOString())

    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(source.getSnapshot()).toBe(updated)
    expect(app.calls.callServerTool.at(-1)).toEqual({
      name: 'get_board',
      arguments: { sinceRevision: 5 },
    })
  })

  test('backs off 10 s, 30 s and 60 s after errors, then polls every 3 s again', async () => {
    const app = queuedApp(
      new Error('Gone'),
      { content: [{ type: 'text', text: 'No.' }], isError: true },
      new Error('Gone'),
      new Error('Gone'),
      unchanged(4)
    )
    const source = createBoardSource(app, board(4))
    source.start()
    const pollsAt: number[] = []
    const shown: boolean[] = []
    const startedAt = Date.now()
    let calls = 0

    for (let elapsed = 0; elapsed < 180_000; elapsed += 500) {
      await vi.advanceTimersByTimeAsync(500)
      if (app.calls.callServerTool.length > calls) {
        calls = app.calls.callServerTool.length
        pollsAt.push(Date.now() - startedAt)
        shown.push(source.getSnapshot().unreachable)
      }
    }

    const first = POLL_MS
    const gaps = [BACKOFF_MS[0], BACKOFF_MS[1], BACKOFF_MS[2], BACKOFF_MS[2], POLL_MS, POLL_MS]
    const expected = gaps.reduce((times, gap) => [...times, times.at(-1)! + gap], [first])
    expect(pollsAt.slice(0, expected.length)).toEqual(expected)
    expect(shown.slice(0, 6)).toEqual([true, true, true, true, false, false])
  })

  test('a write result replaces the board and starts the 3 s wait again', async () => {
    const app = queuedApp()
    const source = createBoardSource(app, board(4))
    source.start()

    await vi.advanceTimersByTimeAsync(POLL_MS - 1000)
    source.replace(board(6))
    expect(source.getSnapshot().board.revision).toBe(6)
    expect(source.getSnapshot().updatedAt).toBeNull()

    await vi.advanceTimersByTimeAsync(POLL_MS - 1)
    expect(app.calls.callServerTool).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(app.calls.callServerTool).toEqual([
      { name: 'get_board', arguments: { sinceRevision: 6 } },
    ])
  })

  test('a slow poll with a lower revision than a write result is ignored', async () => {
    const slow = deferred<CallToolResult>()
    const app = queuedApp(slow.promise)
    const source = createBoardSource(app, board(4))
    source.start()

    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(app.calls.callServerTool).toHaveLength(1)
    source.replace(board(7))
    slow.resolve(boardResult(board(5)))
    await vi.advanceTimersByTimeAsync(0)

    expect(source.getSnapshot().board.revision).toBe(7)
    expect(source.getSnapshot().updatedAt).toBeNull()
  })

  test('names the Your turn items a poll brought, and keeps them until another poll brings more', async () => {
    const first = yourStep('a', 'Review the PR')
    const second = yourStep('b', 'Choose the cache key')
    const app = queuedApp(
      boardResult(board(5, { yourTurn: [first] })),
      boardResult(board(6, { yourTurn: [first] })),
      boardResult(board(7, { yourTurn: [first, second] }))
    )
    const source = createBoardSource(app, board(4))
    source.start()

    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(source.getSnapshot()).toMatchObject({ arrived: [first], arrivals: 1 })
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(source.getSnapshot()).toMatchObject({ arrived: [first], arrivals: 1 })
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(source.getSnapshot()).toMatchObject({ arrived: [second], arrivals: 2 })
  })
})
