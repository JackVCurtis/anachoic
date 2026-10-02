import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import type { ActionResult, BoardProps, TaskProps } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { refusedResult, taskProps, taskResult } from '../../bridge/testing/task_props'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const TASK = { id: '12', displayId: 'T-012', title: 'Add caching' }

/** The board with T-012 in the backlog, which the user opens. */
const BOARD: BoardProps = {
  ...emptyBoardProps(5),
  backlog: [{ task: TASK, steps: [], canAct: { queue: true, archive: true } }],
}

/** T-012 in the given list, with the actions the server allows there. */
function task(revision: number, list: 'working' | 'backlog', canAct: TaskProps['canAct']) {
  const props = taskProps(revision)
  return {
    ...props,
    task: { ...props.task, status: list === 'working' ? 'active' : 'backlog', list },
    canAct,
  } satisfies TaskProps
}

function acted(board: BoardProps, status: 'backlog' | 'done'): ActionResult {
  return { ...board, acted: { task: TASK, status, position: null } }
}

/**
 * A fake App with T-012 active until an action succeeds, and the given
 * answers to move_to_backlog and archive_task.
 */
function fakeApp(answers: { park?: CallToolResult; archive?: CallToolResult }) {
  let current: CallToolResult = taskResult(task(5, 'working', { park: true, archive: true }))
  let revision = 5
  const app = new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      switch (params.name) {
        case 'get_task':
          return since === undefined || since < revision
            ? current
            : taskResult({ changed: false, revision: since })
        case 'move_to_backlog':
          if (!answers.park!.isError) {
            current = taskResult(task(6, 'backlog', { park: false, archive: true }))
            revision = 6
          }
          return answers.park!
        case 'archive_task':
          if (!answers.archive!.isError) {
            current = refusedResult('T-012 was archived')
            revision = 6
          }
          return answers.archive!
        default:
          return since === undefined
            ? boardResult(BOARD)
            : boardResult({ changed: false, revision: since })
      }
    },
  })
  return app
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function openTask(app: FakeApp) {
  const { connection, source } = await loadBoard({ app })
  render(
    <ViewFrame>
      <BoardEntry connection={connection} source={source} />
    </ViewFrame>
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add caching' }))
  await settle()
  return user
}

async function confirm(user: ReturnType<typeof userEvent.setup>, action: 'Park' | 'Archive') {
  await user.click(screen.getByRole('button', { name: action }))
  await user.click(screen.getAllByRole('button', { name: action }).at(-1)!)
  await settle()
}

describe('Park and Archive in the board task panel', () => {
  test('Park calls move_to_backlog once, posts nothing, and the view stays on the task in the Backlog', async () => {
    const app = fakeApp({ park: boardResult(acted(BOARD, 'backlog')) })
    const user = await openTask(app)

    await confirm(user, 'Park')

    expect(app.callsTo('move_to_backlog')).toEqual([
      { name: 'move_to_backlog', arguments: { task: 'T-012' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.getByRole('heading', { level: 2, name: 'Add caching' })).toBeVisible()
    expect(screen.getByText('backlog')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Park' })).toBeNull()
  })

  test('Archive calls archive_task once, posts nothing, and returns to the board with focus on the Done heading', async () => {
    const app = fakeApp({ archive: boardResult(acted(emptyBoardProps(6), 'done')) })
    const user = await openTask(app)

    await confirm(user, 'Archive')

    expect(app.callsTo('archive_task')).toEqual([
      { name: 'archive_task', arguments: { task: 'T-012' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.queryByRole('heading', { level: 2, name: 'Add caching' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Done' })).toHaveFocus()
  })

  test('a refusal shows an error strip in the task view and posts nothing', async () => {
    const app = fakeApp({ park: refusedResult('T-012 is not active') })
    const user = await openTask(app)

    await confirm(user, 'Park')

    expect(app.callsTo('move_to_backlog')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('T-012 is not active')
    expect(screen.getByRole('heading', { level: 2, name: 'Add caching' })).toBeVisible()
    expect(app.calls.sendMessage).toEqual([])
  })
})
