import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import type { BoardProps, SessionItem } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const IDLE_WORKER: SessionItem = { id: 'worker-1', kind: 'worker', name: 'api-server', live: true }

const FIRST: BoardProps = { ...emptyBoardProps(3), sessions: [IDLE_WORKER] }

function fakeApp(removeAnswer: CallToolResult) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      if (params.name === 'remove_session') {
        return removeAnswer
      }
      const since = params.arguments?.sinceRevision as number | undefined
      return since === undefined
        ? boardResult(FIRST)
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

function workerCard() {
  return screen.getByText('api-server').closest('article, li') as HTMLElement
}

describe('Remove on a worker card', () => {
  test('calls remove_session once with the session id, draws the result and posts nothing', async () => {
    const app = fakeApp(boardResult(emptyBoardProps(4)))
    const { user } = await renderBoard(app)

    await user.click(within(workerCard()).getByRole('button', { name: 'Remove' }))
    await act(() => Promise.resolve())

    expect(app.callsTo('remove_session')).toEqual([
      { name: 'remove_session', arguments: { session: 'worker-1' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.queryByText('api-server')).toBeNull()
  })

  test('a refusal keeps the card, shows the error and posts nothing', async () => {
    const app = fakeApp({
      content: [{ type: 'text', text: 'The board is busy. Try again.' }],
      isError: true,
    })
    const { user } = await renderBoard(app)

    await user.click(within(workerCard()).getByRole('button', { name: 'Remove' }))
    await act(() => Promise.resolve())

    expect(screen.getByText('api-server')).toBeTruthy()
    expect(screen.getByText('The board is busy. Try again.')).toBeTruthy()
    expect(app.calls.sendMessage).toEqual([])
  })
})
