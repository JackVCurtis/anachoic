import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { BoardProps } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { BoardEntry, loadBoard } from './board_entry'

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

describe('the board entry', () => {
  test('draws what get_board returned, not the replayed result, and fetches once', async () => {
    const app = new FakeApp({
      hostContext: { safeAreaInsets: { top: 30, right: 0, bottom: 0, left: 0 } },
      replayedResult: boardResult(REPLAYED),
      answer: () => boardResult(emptyBoardProps()),
    })

    const { connection, board } = await loadBoard({ app })
    render(<BoardEntry connection={connection} board={board!} />)

    expect(app.callsTo('get_board')).toEqual([{ name: 'get_board', arguments: {} }])
    expect(app.calls.callServerTool).toHaveLength(1)
    expect(screen.queryByText('An old task from the replay')).toBeNull()
    expect(screen.getByText('Nothing waiting on you')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Board')
  })

  test('has no board to draw when get_board refuses or cannot be reached', async () => {
    const refusing = new FakeApp({
      answer: () => ({ content: [{ type: 'text', text: 'No.' }], isError: true }),
    })
    const unreachable = new FakeApp({ answer: () => new Error('Gone') })

    const refused = await loadBoard({ app: refusing })
    const unanswered = await loadBoard({ app: unreachable })

    expect(refused.board).toBeNull()
    expect(unanswered.board).toBeNull()
  })
})
