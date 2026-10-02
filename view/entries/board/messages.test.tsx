import { act, fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test, vi } from 'vitest'
import type { BacklogItem, BoardProps } from '../../../shared/props'
import { BACKOFF_MS, POLL_MS } from '../../bridge/board_source'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp, type ToolAnswer } from '../../bridge/testing/fake_app'
import { boardHeader, message } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

function backlogged(id: string, title: string): BacklogItem {
  return {
    task: { id, displayId: `T-0${id}`, title },
    steps: [],
    canAct: { queue: true, archive: true },
  }
}

const BOARD: BoardProps = {
  ...emptyBoardProps(3),
  backlog: [backlogged('11', 'Rename the queue'), backlogged('12', 'Add retries')],
}

function refusal(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/**
 * A fake App whose get_board gives BOARD and then no change, and whose
 * queue_task_from_view gives the answers given in turn.
 */
function writeApp(writes: Array<ReturnType<ToolAnswer>>) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      if (params.name !== 'get_board') {
        return writes.shift()!
      }
      const since = params.arguments?.sinceRevision as number | undefined
      return since === undefined ? boardResult(BOARD) : boardResult({ changed: false, revision: 3 })
    },
  })
}

async function renderBoard(app: FakeApp) {
  const { connection, source } = await loadBoard({ app })
  render(
    <ViewFrame>
      <BoardEntry connection={connection} source={source} />
    </ViewFrame>
  )
}

function queueButtons() {
  return screen.getAllByRole('button', { name: 'Queue' })
}

describe('the message region', () => {
  test('a refused write shows an error strip with its sentence and posts no message', async () => {
    const app = writeApp([refusal('T-011 is in the queue, not the backlog')])
    await renderBoard(app)
    const user = userEvent.setup()

    await user.click(queueButtons()[0])

    const strip = screen.getByRole('alert')
    expect(strip).toHaveTextContent(`${message.error} T-011 is in the queue, not the backlog`)
    expect(screen.getByRole('region', { name: 'Messages' })).toContainElement(strip)
    expect(app.calls.sendMessage).toEqual([])
    expect(document.activeElement).toBe(queueButtons()[0])
  })

  test("a call that never reaches the server shows Can't reach the board; a second refusal replaces it", async () => {
    const app = writeApp([new Error('Gone'), refusal('The board is busy. Try again.')])
    await renderBoard(app)
    const user = userEvent.setup()

    await user.click(queueButtons()[0])
    expect(screen.getByRole('alert')).toHaveTextContent(boardHeader.cantReach)

    await user.click(queueButtons()[1])
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('The board is busy. Try again.')
    expect(app.calls.sendMessage).toEqual([])
  })

  test("Dismiss from the keyboard removes the strip and moves focus to the board's heading", async () => {
    const app = writeApp([refusal('T-011 was archived')])
    await renderBoard(app)
    const user = userEvent.setup()

    await user.click(queueButtons()[0])
    screen.getByRole('button', { name: message.dismiss }).focus()
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Board' }))
  })

  test('the same words again are a new message', async () => {
    const app = writeApp([refusal('T-011 was archived'), refusal('T-011 was archived')])
    await renderBoard(app)
    const user = userEvent.setup()

    await user.click(queueButtons()[0])
    await user.click(screen.getByRole('button', { name: message.dismiss }))
    expect(screen.queryByRole('alert')).toBeNull()

    await user.click(queueButtons()[0])
    expect(screen.getByRole('alert')).toHaveTextContent('T-011 was archived')
  })
})

describe('a refusal while polling', () => {
  const UNREADABLE = "The board's database at /data/board.sqlite can't be read"

  test('is shown once while polls keep giving the same sentence, and still backs off', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      const polls: Array<ReturnType<ToolAnswer>> = [
        boardResult(BOARD),
        refusal(UNREADABLE),
        refusal(UNREADABLE),
        refusal(UNREADABLE),
        refusal('The board is busy. Try again.'),
      ]
      const app = new FakeApp({
        hostContext: { displayMode: 'inline', timeZone: 'UTC' },
        answer: () => polls.shift() ?? boardResult({ changed: false, revision: 3 }),
      })
      await renderBoard(app)
      const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
      const getBoards = () => app.callsTo('get_board').length

      await advance(POLL_MS)
      expect(screen.getByRole('alert')).toHaveTextContent(UNREADABLE)
      expect(screen.getByText(boardHeader.cantReach)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: message.dismiss }))
      expect(screen.queryByRole('alert')).toBeNull()

      await advance(BACKOFF_MS[0] - 1)
      expect(getBoards()).toBe(2)
      await advance(1)
      expect(getBoards()).toBe(3)
      await advance(BACKOFF_MS[1])
      expect(getBoards()).toBe(4)
      expect(screen.queryByRole('alert')).toBeNull()

      await advance(BACKOFF_MS[2])
      expect(screen.getByRole('alert')).toHaveTextContent('The board is busy. Try again.')
    } finally {
      vi.useRealTimers()
    }
  })
})
