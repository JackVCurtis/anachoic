import { Profiler } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { BoardProps, QueueItem, YourTurnItem } from '../../../shared/props'
import { BACKOFF_MS, POLL_MS } from '../../bridge/board_source'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp, type ToolAnswer } from '../../bridge/testing/fake_app'
import { boardHeader, queue as queueWords } from '../../components/helpers/strings'
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

function blocked(id: string, title: string, session: string): YourTurnItem {
  return {
    task: { id, displayId: `T-0${id}`, title },
    step: { number: 2, title: 'Deploy', owner: 'agent', waitingSince: START.toISOString() },
    session: { id: `session-${session}`, name: session },
    blocked: { reason: 'Needs AWS credentials', since: START.toISOString() },
    steps: [],
    canAct: { park: true },
  }
}

function board(revision: number, yourTurn: YourTurnItem[] = []): BoardProps {
  return {
    ...emptyBoardProps(revision),
    yourTurn,
    counts: { yourTurn: yourTurn.length, working: 0, queue: 0, toSignOff: 0 },
  }
}

function queued(id: string, title: string, position: number): QueueItem {
  return {
    task: { id, displayId: `T-0${id}`, title },
    position,
    nextOwner: 'agent',
    steps: [],
    canAct: { reorder: true, backlog: true },
  }
}

const QUEUED = [
  queued('13', 'Upgrade the queue client', 1),
  queued('15', 'Add retries', 2),
  queued('19', 'Write the setup guide', 3),
]

function queueBoard(revision: number, items: QueueItem[]): BoardProps {
  return {
    ...emptyBoardProps(revision),
    queue: items,
    counts: { yourTurn: 0, working: 0, queue: items.length, toSignOff: 0 },
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
    expect(screen.getByText('Nothing waiting on the user')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Board')
  })

  test('when get_board refuses or cannot be reached at first, the entry tries again and then draws', async () => {
    const app = queuedApp([
      { content: [{ type: 'text', text: 'No.' }], isError: true },
      new Error('Gone'),
      boardResult(emptyBoardProps()),
    ])
    let loaded: Awaited<ReturnType<typeof loadBoard>> | null = null
    void loadBoard({ app }).then((result) => {
      loaded = result
    })

    await act(() => vi.advanceTimersByTimeAsync(BACKOFF_MS[0] + BACKOFF_MS[1]))
    expect(app.callsTo('get_board')).toHaveLength(3)
    expect(loaded!.source.getSnapshot().board).toEqual(emptyBoardProps())
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

  test('removing a focused Waiting on user card moves focus to the Waiting on user header, without scrolling', async () => {
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
      screen.getByRole('heading', { level: 2, name: 'Waiting on user' })
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

  test('says politely when a poll brings a task into Waiting on user, for each kind of card', async () => {
    const app = queuedApp([
      boardResult(board(3, [yourStep('a', 'Review the PR')])),
      boardResult(board(4, [yourStep('a', 'Review the PR'), yourStep('b', 'Ship it')])),
      boardResult(board(5, [yourStep('b', 'Ship it')])),
      boardResult(board(6, [yourStep('b', 'Ship it'), question('c', 'Cache keys', 'Session 2')])),
    ])
    await renderEntry(app)
    expect(liveRegion().textContent).toBe('')

    await advance(POLL_MS)
    expect(liveRegion().textContent).toBe('“Ship it” is waiting on the user')

    await advance(POLL_MS)
    expect(liveRegion().textContent).toBe('“Ship it” is waiting on the user')

    await advance(POLL_MS)
    expect(liveRegion().textContent).toBe('Session 2 asks about “Cache keys”')
  })

  test('draws a blocked step as a blocked card and its worker as blocked, until it is unblocked', async () => {
    const holdingBlocked = (revision: number, items: YourTurnItem[]): BoardProps => ({
      ...board(revision, items),
      sessions: [
        {
          id: 'session-api-server',
          kind: 'worker',
          name: 'api-server',
          live: true,
          holding: {
            task: { id: '12', displayId: 'T-012', title: 'Ship it' },
            step: { number: 2, title: 'Deploy' },
            status: 'blocked',
          },
        },
      ],
    })
    const app = queuedApp([
      boardResult(holdingBlocked(3, [blocked('12', 'Ship it', 'api-server')])),
      boardResult(board(4)),
    ])
    await renderEntry(app)
    const yourTurnSection = screen
      .getByRole('heading', { level: 2, name: /^Waiting on user/ })
      .closest('section')!

    expect(within(yourTurnSection).getByText('Needs AWS credentials')).toBeTruthy()
    expect(within(yourTurnSection).getByText('Unblock it in api-server’s session')).toBeTruthy()
    expect(
      within(yourTurnSection)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Ship it'])
    expect(screen.getByText('Blocked on T-012 step 2')).toBeTruthy()

    await advance(POLL_MS)

    expect(screen.queryByText('Needs AWS credentials')).toBeNull()
    expect(screen.queryByText('Blocked on T-012 step 2')).toBeNull()
    expect(app.calls.sendMessage).toEqual([])
  })

  test('says which worker blocked a task that a poll brings into Waiting on user blocked', async () => {
    const app = queuedApp([
      boardResult(board(3, [yourStep('a', 'Review the PR')])),
      boardResult(
        board(4, [yourStep('a', 'Review the PR'), blocked('12', 'Ship it', 'api-server')])
      ),
    ])
    await renderEntry(app)

    await advance(POLL_MS)

    expect(liveRegion().textContent).toBe('T-012 is blocked in api-server')
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

describe('reordering the queue', () => {
  function queueTitles() {
    const list = screen
      .getByRole('heading', { level: 2, name: queueWords.title })
      .closest('section')!
    return Array.from(list.querySelectorAll('li h3')).map((heading) => heading.textContent)
  }

  /**
   * A fake App whose reorder_queue gives the answer given, and whose get_board
   * gives the queue in its first order and then reports no change.
   */
  function reorderApp(answer: CallToolResult) {
    return new FakeApp({
      hostContext: { displayMode: 'inline', timeZone: 'UTC' },
      answer: (params) => {
        if (params.name === 'reorder_queue') {
          return answer
        }
        const since = params.arguments?.sinceRevision as number | undefined
        return since === undefined ? boardResult(queueBoard(3, QUEUED)) : unchanged(since)
      },
    })
  }

  const MOVED = [
    { ...QUEUED[2], position: 1 },
    { ...QUEUED[0], position: 2 },
    { ...QUEUED[1], position: 3 },
  ]

  async function dropThirdAtFront() {
    const item = screen.getByRole('button', { name: 'Write the setup guide' }).closest('li')!
    const handle = item.querySelector('button')!
    handle.focus()
    await act(async () => {
      handle.click()
    })
    await act(async () => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    })
    await act(async () => {
      handle.click()
    })
  }

  test('a drop calls reorder_queue with the display id and position, draws the result and posts nothing', async () => {
    const app = reorderApp({
      content: [{ type: 'text', text: 'Moved T-019 to position 1.' }],
      structuredContent: {
        ...queueBoard(4, MOVED),
        acted: { task: MOVED[0].task, status: 'queue', position: 1 },
      },
    })
    await renderEntry(app)

    await dropThirdAtFront()
    await advance(0)

    expect(app.callsTo('reorder_queue')).toEqual([
      { name: 'reorder_queue', arguments: { task: 'T-019', position: 1 } },
    ])
    expect(queueTitles()).toEqual([
      'Write the setup guide',
      'Upgrade the queue client',
      'Add retries',
    ])
    expect(app.calls.sendMessage).toEqual([])
  })

  test('a refusal is shown as an error and the queue keeps the order the props give', async () => {
    const app = reorderApp({
      content: [{ type: 'text', text: 'T-019 is in the backlog, not the queue' }],
      isError: true,
    })
    await renderEntry(app)

    await dropThirdAtFront()
    await advance(0)

    expect(screen.getByRole('alert')).toHaveTextContent('T-019 is in the backlog, not the queue')
    expect(queueTitles()).toEqual([
      'Upgrade the queue client',
      'Add retries',
      'Write the setup guide',
    ])
    expect(app.calls.sendMessage).toEqual([])
  })
})
