import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import type { BoardProps, QueueItem } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp, type FakeAppOptions } from '../../bridge/testing/fake_app'
import { refusedResult, taskProps, taskResult } from '../../bridge/testing/task_props'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

function queued(id: string, title: string, position: number): QueueItem {
  return {
    task: { id, displayId: `T-0${id}`, title },
    position,
    nextOwner: 'agent',
    steps: [],
    canAct: { reorder: true, backlog: true },
  }
}

function queueBoard(revision: number, items: QueueItem[]): BoardProps {
  return {
    ...emptyBoardProps(revision),
    queue: items,
    counts: { yourTurn: 0, working: 0, queue: items.length, toSignOff: 0 },
  }
}

const WITH_TASK = queueBoard(5, [queued('12', 'Add caching', 1), queued('15', 'Add retries', 2)])

interface Answers {
  /** The board get_board gives when asked in full. */
  boards: BoardProps[]
  task?: () => CallToolResult
  hostContext?: FakeAppOptions['hostContext']
}

/**
 * A fake App whose get_board gives each board in turn when asked in full,
 * and whose get_task gives the task, unchanged since any revision asked about.
 */
function fakeApp({ boards, task = () => taskResult(taskProps(5)), hostContext }: Answers) {
  return new FakeApp({
    hostContext: hostContext ?? { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      if (params.name === 'get_task') {
        return since === undefined ? task() : taskResult({ changed: false, revision: since })
      }
      if (since !== undefined) {
        return boardResult({ changed: false, revision: since })
      }
      return boardResult(boards.length > 1 ? boards.shift()! : boards[0])
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

describe('the board task panel', () => {
  test('pressing a card title calls get_task and shows the task, with focus on its title', async () => {
    const app = fakeApp({ boards: [WITH_TASK] })
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    expect(app.callsTo('get_task')[0]).toEqual({ name: 'get_task', arguments: { task: '12' } })
    const title = screen.getByRole('heading', { level: 2, name: 'Add caching' })
    expect(title).toHaveFocus()
    expect(screen.getByText('Open the PR')).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Queue/ })).toBeNull()
    expect(app.calls.sendMessage).toEqual([])
  })

  test('while it loads the header shows what the card knew and the body a busy indicator', async () => {
    let release: (result: CallToolResult) => void = () => {}
    const app = fakeApp({
      boards: [WITH_TASK],
      task: () => new Promise<CallToolResult>((resolve) => (release = resolve)) as never,
    })
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: 'Add caching' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Add caching' })).toBeVisible()
    expect(screen.getByText('Loading task…')).toBeVisible()
    await act(async () => release(taskResult(taskProps(5))))
    expect(screen.getByText('Open the PR')).toBeVisible()
  })

  test('Back to board restores the board, fetches it, and returns focus to the card', async () => {
    const app = fakeApp({ boards: [WITH_TASK] })
    const { user } = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()
    const fetched = app.callsTo('get_board').length

    await user.click(screen.getByRole('button', { name: 'Back to board' }))
    await settle()

    expect(screen.queryByRole('heading', { level: 2, name: 'Add caching' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add caching' })).toHaveFocus()
    const after = app.callsTo('get_board').slice(fetched)
    expect(after.some((call) => call.arguments?.sinceRevision === undefined)).toBe(true)
  })

  test('when the card is gone, focus goes to its section header', async () => {
    const app = fakeApp({ boards: [WITH_TASK, queueBoard(6, [queued('15', 'Add retries', 1)])] })
    const { user } = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    await user.click(screen.getByRole('button', { name: 'Back to board' }))
    await settle()

    expect(screen.queryByRole('button', { name: 'Add caching' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /Queue/ })).toHaveFocus()
  })

  test('a task that was archived shows the refusal in place of the chain', async () => {
    const app = fakeApp({ boards: [WITH_TASK], task: () => refusedResult('T-012 was archived') })
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    expect(screen.getByText('T-012 was archived')).toBeVisible()
    expect(screen.queryByText('Handoff chain')).toBeNull()
  })

  test('Open in full screen asks the host for full screen, when the host offers it', async () => {
    const app = fakeApp({
      boards: [WITH_TASK],
      hostContext: {
        displayMode: 'inline',
        availableDisplayModes: ['inline', 'fullscreen'],
        timeZone: 'UTC',
      },
    })
    const { user } = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    await user.click(screen.getByRole('button', { name: 'Open in full screen' }))

    expect(app.calls.requestDisplayMode).toEqual([{ mode: 'fullscreen' }])
  })

  test('a step link opens through the host', async () => {
    const props = taskProps(5)
    props.steps[0] = {
      ...props.steps[0],
      links: [{ label: 'CI run', url: 'https://ci.example.com/1' }],
    }
    const app = fakeApp({ boards: [WITH_TASK], task: () => taskResult(props) })
    const { user } = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    await user.click(screen.getByRole('link', { name: /CI run/ }))

    expect(app.calls.openLink).toEqual([{ url: 'https://ci.example.com/1' }])
  })
})
