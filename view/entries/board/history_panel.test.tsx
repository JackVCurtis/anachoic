import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { BoardProps } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { historyProps, historyResult } from '../../bridge/testing/history_props'
import { taskProps, taskResult } from '../../bridge/testing/task_props'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const SIGNED_OFF: BoardProps = {
  ...emptyBoardProps(5),
  signedOff: [
    {
      task: { id: '12', displayId: 'T-012', title: 'Add caching' },
      signedOffAt: '2026-03-12T09:41:00.000Z',
    },
  ],
}

function fakeApp(board: BoardProps = SIGNED_OFF) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      if (params.name === 'get_history') {
        return since === undefined
          ? historyResult(historyProps(5))
          : historyResult({ changed: false, revision: since })
      }
      if (params.name === 'get_task') {
        return since === undefined
          ? taskResult(taskProps(5))
          : taskResult({ changed: false, revision: since })
      }
      return since === undefined
        ? boardResult(board)
        : boardResult({ changed: false, revision: since })
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
  return { user: userEvent.setup() }
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

describe('the board History panel', () => {
  test('the Done section’s link calls get_history and swaps in the History panel', async () => {
    const app = fakeApp()
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: 'Show all completed tasks' }))
    await settle()

    expect(app.callsTo('get_history')[0]).toEqual({ name: 'get_history', arguments: { page: 1 } })
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toHaveFocus()
    expect(screen.getByText('1 completed task')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: /Done/ })).toBeNull()
    expect(app.calls.sendMessage).toEqual([])
  })

  test('Back to board returns to the board, fetches it, and focuses the link', async () => {
    const app = fakeApp()
    const { user } = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Show all completed tasks' }))
    await settle()
    const fetched = app.callsTo('get_board').length

    await user.click(screen.getByRole('button', { name: 'Back to board' }))
    await settle()

    expect(screen.queryByRole('heading', { level: 1, name: 'History' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show all completed tasks' })).toHaveFocus()
    const after = app.callsTo('get_board').slice(fetched)
    expect(after.some((call) => call.arguments?.sinceRevision === undefined)).toBe(true)
  })

  test('a task opened from the History panel goes back to the history, not the board', async () => {
    const app = fakeApp()
    const { user } = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Show all completed tasks' }))
    await settle()

    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()
    expect(screen.queryByRole('button', { name: 'Back to board' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back to history' }))
    await settle()

    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add caching' })).toHaveFocus()
  })

  test('with nothing signed off the Done section offers no link to the history', async () => {
    await renderBoard(fakeApp(emptyBoardProps(5)))

    expect(screen.queryByRole('button', { name: 'Show all completed tasks' })).toBeNull()
  })
})
