import { Profiler } from 'react'
import { act, render, screen } from '@testing-library/react'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { BoardProps, YourTurnItem } from '../../../shared/props'
import { BACKOFF_MS, POLL_MS } from '../../bridge/board_source'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp, type ToolAnswer } from '../../bridge/testing/fake_app'
import { boardHeader } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const START = new Date('2026-03-12T09:41:00.000Z')

/**
 * A board the host replays from an old show_board result, with a task the
 * current board no longer has.
 */
const REPLAYED: BoardProps = {
  ...emptyBoardProps(7),
  backlog: [
    {
      task: { id: 'task-99', displayId: 'T-099', title: 'An old task from the replay' },
      steps: [],
      canAct: { queue: true, archive: true },
    },
  ],
}

function yourStep(id: string, title: string): YourTurnItem {
  return {
    task: { id, displayId: `T-${id}`, title },
    step: { number: 1, title: 'Review', owner: 'you', waitingSince: START.toISOString() },
    steps: [],
    canAct: { complete: true, park: true },
  }
}

function question(id: string, title: string, session: string): YourTurnItem {
  return {
    task: { id, displayId: `T-${id}`, title },
    step: {
      number: 2,
      title: 'Pick a key',
      owner: 'agent',
      question: 'Which key?',
      waitingSince: START.toISOString(),
    },
    session: { id: `session-${session}`, name: session },
    steps: [],
    canAct: { answer: true, park: true },
  }
}

function board(revision: number, yourTurn: YourTurnItem[] = []): BoardProps {
  return {
    ...emptyBoardProps(revision),
    yourTurn,
    counts: { yourTurn: yourTurn.length, working: 0, queue: 0, toSignOff: 0 },
  }
}

function unchanged(revision: number): CallToolResult {
  return boardResult({ changed: false, revision })
}

/**
 * A fake App whose get_board gives the queued answers in turn, and then says
 * the board has not changed since the revision asked about.
 */
function queuedApp(answers: Array<ReturnType<ToolAnswer>>, replayed?: BoardProps) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    replayedResult: replayed ? boardResult(replayed) : undefined,
    answer: (params) =>
      answers.length > 0
        ? answers.shift()!
        : unchanged((params.arguments?.sinceRevision as number | undefined) ?? 0),
  })
}

let commits = 0

function countCommit() {
  commits += 1
}

async function renderEntry(app: FakeApp) {
  const { connection, source } = await loadBoard({ app })
  const result = render(
    <ViewFrame>
      <Profiler id="board" onRender={countCommit}>
        <BoardEntry connection={connection} source={source!} />
      </Profiler>
    </ViewFrame>
  )
  return { ...result, connection, source: source! }
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

function liveRegion() {
  return document.querySelector('[aria-live="polite"]')!
}

beforeEach(() => {
  commits = 0
  vi.useFakeTimers({
    now: START,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the board entry', () => {
  test('draws what get_board returned, not the replayed result, and fetches once', async () => {
    const app = queuedApp([boardResult(emptyBoardProps())], REPLAYED)
    await renderEntry(app)

    expect(app.callsTo('get_board')).toEqual([{ name: 'get_board', arguments: {} }])
    expect(app.calls.callServerTool).toHaveLength(1)
    expect(screen.queryByText('An old task from the replay')).toBeNull()
    expect(screen.getByText('Nothing waiting on you')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Board')
  })

  test('has no board to draw when get_board refuses or cannot be reached', async () => {
    const refused = await loadBoard({
      app: queuedApp([{ content: [{ type: 'text', text: 'No.' }], isError: true }]),
    })
    const unanswered = await loadBoard({ app: queuedApp([new Error('Gone')]) })

    expect(refused.source).toBeNull()
    expect(unanswered.source).toBeNull()
  })

  test('a poll that finds the board unchanged renders nothing; a newer revision redraws', async () => {
    const app = queuedApp([
      boardResult(board(3)),
      unchanged(3),
      unchanged(3),
      boardResult(board(4, [yourStep('a', 'Review the PR')])),
    ])
    const { container } = await renderEntry(app)
    const frame = container.firstElementChild!
    const html = frame.innerHTML
    commits = 0

    await advance(POLL_MS * 2)
    expect(app.callsTo('get_board')).toHaveLength(3)
    expect(commits).toBe(0)
    expect(frame.innerHTML).toBe(html)

    await advance(POLL_MS)
    expect(commits).toBeGreaterThan(0)
    expect(screen.getByText('Review the PR')).toBeTruthy()
    expect(screen.getByText('Updated just now')).toBeTruthy()
  })

  test("backs off to 10 s and 30 s after failed polls, shows Can't reach the board until one succeeds, then polls every 3 s", async () => {
    const app = queuedApp([boardResult(board(3)), new Error('Gone'), new Error('Gone')])
    await renderEntry(app)
    const polls = () => app.callsTo('get_board').length - 1

    await advance(POLL_MS)
    expect(polls()).toBe(1)
    expect(screen.getByText(boardHeader.cantReach)).toBeTruthy()

    await advance(BACKOFF_MS[0] - 1)
    expect(polls()).toBe(1)
    await advance(1)
    expect(polls()).toBe(2)
    expect(screen.getByText(boardHeader.cantReach)).toBeTruthy()

    await advance(BACKOFF_MS[1] - 1)
    expect(polls()).toBe(2)
    await advance(1)
    expect(polls()).toBe(3)
    expect(screen.queryByText(boardHeader.cantReach)).toBeNull()

    await advance(POLL_MS)
    expect(polls()).toBe(4)
    await advance(POLL_MS)
    expect(polls()).toBe(5)
  })

  test('a slow poll with a lower revision than a write result is ignored', async () => {
    let answerSlowPoll!: (result: CallToolResult) => void
    const slow = new Promise<CallToolResult>((resolve) => {
      answerSlowPoll = resolve
    })
    const app = queuedApp([boardResult(board(3)), slow])
    const { source } = await renderEntry(app)

    await advance(POLL_MS)
    act(() => source.replace(board(5, [yourStep('w', 'Written by you')])))
    answerSlowPoll(boardResult(board(4, [yourStep('s', 'From the slow poll')])))
    await advance(0)

    expect(screen.getByText('Written by you')).toBeTruthy()
    expect(screen.queryByText('From the slow poll')).toBeNull()
  })

  test('removing a focused Your turn card moves focus to the Your turn header, without scrolling', async () => {
    const app = queuedApp([
      boardResult(board(3, [yourStep('a', 'Review the PR'), yourStep('b', 'Ship it')])),
      boardResult(board(4, [yourStep('b', 'Ship it')])),
    ])
    await renderEntry(app)
    const card = screen.getByRole('button', { name: 'Review the PR' })
    card.focus()
    const scroll = [window.scrollX, window.scrollY]

    await advance(POLL_MS)

    expect(screen.queryByText('Review the PR')).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Your turn' })
    )
    expect([window.scrollX, window.scrollY]).toEqual(scroll)
  })

  test('a card that stays keeps its focus when another leaves', async () => {
    const app = queuedApp([
      boardResult(board(3, [yourStep('a', 'Review the PR'), yourStep('b', 'Ship it')])),
      boardResult(board(4, [yourStep('b', 'Ship it')])),
    ])
    await renderEntry(app)
    const staying = screen.getByRole('button', { name: 'Ship it' })
    staying.focus()

    await advance(POLL_MS)

    expect(document.activeElement).toBe(staying)
  })

  test('says politely when a poll brings a task into Your turn, for each kind of card', async () => {
    const app = queuedApp([
      boardResult(board(3, [yourStep('a', 'Review the PR')])),
      boardResult(board(4, [yourStep('a', 'Review the PR'), yourStep('b', 'Ship it')])),
      boardResult(board(5, [yourStep('b', 'Ship it')])),
      boardResult(board(6, [yourStep('b', 'Ship it'), question('c', 'Cache keys', 'Session 2')])),
    ])
    await renderEntry(app)
    expect(liveRegion().textContent).toBe('')

    await advance(POLL_MS)
    expect(liveRegion().textContent).toBe('“Ship it” is waiting on you')

    await advance(POLL_MS)
    expect(liveRegion().textContent).toBe('“Ship it” is waiting on you')

    await advance(POLL_MS)
    expect(liveRegion().textContent).toBe('Session 2 asks about “Cache keys”')
  })

  test('the view is as tall after 20 dimension-only context changes, which render nothing', async () => {
    const app = queuedApp([boardResult(board(3, [yourStep('a', 'Review the PR')]))])
    const { container } = await renderEntry(app)
    const height = container.getBoundingClientRect().height
    const documentHeight = document.documentElement.getBoundingClientRect().height
    commits = 0

    for (let update = 1; update <= 20; update += 1) {
      act(() =>
        app.emitHostContextChange({ containerDimensions: { width: 735, maxHeight: 5000 + update } })
      )
    }

    expect(commits).toBe(0)
    expect(container.getBoundingClientRect().height).toBe(height)
    expect(document.documentElement.getBoundingClientRect().height).toBe(documentHeight)
  })
})
