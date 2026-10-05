import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { BoardProps, TaskProps } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { historyProps, historyResult } from '../../bridge/testing/history_props'
import { taskProps, taskResult } from '../../bridge/testing/task_props'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const WORKER = { id: 'w1', name: 'api-server' }
const TASK = { id: '12', displayId: 'T-012', title: 'Add caching', assignedTo: WORKER }

const BOARD: BoardProps = {
  ...emptyBoardProps(5),
  workers: [WORKER],
  backlog: [{ task: TASK, steps: [], canAct: { queue: true, archive: true } }],
  signedOff: [{ task: TASK, signedOffAt: '2026-03-12T09:41:00.000Z' }],
}

/** T-012 assigned to api-server, with an agent step that has a detail and a user step after it. */
function clonedTask(): TaskProps {
  const props = taskProps(5)
  const [first] = props.steps
  return {
    ...props,
    task: { ...props.task, assignedTo: WORKER },
    steps: [
      { ...first!, detail: 'Cache the board query' },
      {
        ...first!,
        id: 's2',
        number: 2,
        owner: 'you',
        title: 'Review the PR',
        current: false,
        outputFormat: null,
        origin: 'follow_up',
      },
    ],
  }
}

function fakeApp() {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      switch (params.name) {
        case 'get_task':
        case 'open_task':
          return since === undefined
            ? taskResult(clonedTask())
            : taskResult({ changed: false, revision: since })
        case 'get_history':
          return since === undefined
            ? historyResult(historyProps(5))
            : historyResult({ changed: false, revision: since })
        default:
          return since === undefined
            ? boardResult(BOARD)
            : boardResult({ changed: false, revision: since })
      }
    },
  })
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function renderBoard(app: FakeApp) {
  const { connection, source } = await loadBoard({ app })
  render(
    <ViewFrame>
      <BoardEntry connection={connection} source={source} />
    </ViewFrame>
  )
  return userEvent.setup()
}

/** Task entry, filled with the copy of T-012. */
function expectFilledEntry() {
  const form = screen.getByRole('form', { name: 'New task' })
  const entry = within(form)
  expect(entry.getByRole('textbox', { name: 'New task' })).toHaveValue('Add caching')
  expect(entry.getByRole('textbox', { name: 'New task' })).toHaveFocus()
  expect(entry.getByRole('combobox', { name: 'Worker' })).toHaveValue('w1')
  expect(entry.getByRole('textbox', { name: 'Title of step 1' })).toHaveValue('Open the PR')
  expect(entry.getByRole('textbox', { name: 'Detail of step 1' })).toHaveValue(
    'Cache the board query'
  )
  expect(entry.getByRole('combobox', { name: 'Output of step 1' })).toHaveValue('pull_request')
  expect(
    within(entry.getByRole('group', { name: 'Owner of step 1' })).getByRole('radio', {
      name: 'Agent',
    })
  ).toBeChecked()
  expect(entry.getByRole('textbox', { name: 'Title of step 2' })).toHaveValue('Review the PR')
  expect(
    within(entry.getByRole('group', { name: 'Owner of step 2' })).getByRole('radio', {
      name: 'User',
    })
  ).toBeChecked()
}

describe('Clone task', () => {
  test('in the board task panel, returns to the board with task entry holding a copy of the task', async () => {
    const app = fakeApp()
    const user = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    await user.click(screen.getByRole('button', { name: 'Clone task' }))
    await settle()

    expect(screen.queryByRole('heading', { level: 2, name: 'Add caching' })).toBeNull()
    expectFilledEntry()
    expect(app.callsTo('add_task_from_view')).toEqual([])
    expect(app.calls.sendMessage).toEqual([])
  })

  test('replaces a draft already in task entry', async () => {
    const app = fakeApp()
    const user = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    await user.type(screen.getByRole('textbox', { name: 'New task' }), 'Something else')
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    await user.click(screen.getByRole('button', { name: 'Clone task' }))
    await settle()

    expectFilledEntry()
  })

  test('in a task opened from the History panel, returns to the board, not the history', async () => {
    const app = fakeApp()
    const user = await renderBoard(app)
    await user.click(screen.getByRole('button', { name: 'Show all completed tasks' }))
    await settle()
    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    await user.click(screen.getByRole('button', { name: 'Clone task' }))
    await settle()

    expect(screen.queryByRole('heading', { level: 1, name: 'History' })).toBeNull()
    expectFilledEntry()
  })
})
