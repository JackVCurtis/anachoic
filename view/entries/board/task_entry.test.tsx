import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import type { ActionResult, BacklogItem, BoardProps } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { backlog as backlogWords, taskEntry } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'
import { taskEntryFieldOf } from './task_entry_refusal'

const ADDED = { id: 'task-15', displayId: 'T-015', title: 'Add retries' }

const BACKLOGGED: BacklogItem = {
  task: { id: 'task-3', displayId: 'T-003', title: 'Rename the queue' },
  steps: [],
  canAct: { queue: true, archive: true },
}

function boardWithBacklog(revision: number, items: BacklogItem[]): BoardProps {
  return { ...emptyBoardProps(revision), backlog: items }
}

function actionResult(props: BoardProps, acted: ActionResult['acted']): CallToolResult {
  const structuredContent: ActionResult = { ...props, acted }
  return { content: [{ type: 'text', text: 'Done' }], structuredContent }
}

function refusal(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/**
 * A fake App whose get_board gives the board given and then reports no
 * change, and whose other tools give the answers given by name.
 */
function fakeApp(first: BoardProps, answers: Record<string, CallToolResult>) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      if (params.name !== 'get_board') {
        return answers[params.name]
      }
      const since = params.arguments?.sinceRevision as number | undefined
      return since === undefined
        ? boardResult(first)
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
  return { user: userEvent.setup(), source }
}

async function fillTask(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
  await user.type(screen.getByRole('textbox', { name: taskEntry.title }), 'Add retries')
  await user.type(screen.getByRole('textbox', { name: 'Title of step 1' }), 'Write the policy')
  await user.click(screen.getByRole('button', { name: taskEntry.addStep }))
  await user.type(screen.getByRole('textbox', { name: 'Title of step 2' }), 'Review it')
  const second = screen.getByRole('group', { name: 'Owner of step 2' })
  await user.click(within(second).getByRole('radio', { name: 'You' }))
}

describe('adding a task from the board', () => {
  test('Add to queue calls add_task_from_view with the steps in order and queue true, draws the result and collapses', async () => {
    const added: BacklogItem = { task: ADDED, steps: [], canAct: { queue: true, archive: true } }
    const app = fakeApp(emptyBoardProps(3), {
      add_task_from_view: actionResult(boardWithBacklog(4, [added]), {
        task: ADDED,
        status: 'queue',
        position: 1,
      }),
    })
    const { user } = await renderBoard(app)

    await fillTask(user)
    await user.click(screen.getByRole('button', { name: taskEntry.addToQueue }))

    expect(app.callsTo('add_task_from_view')).toEqual([
      {
        name: 'add_task_from_view',
        arguments: {
          title: 'Add retries',
          steps: [
            { title: 'Write the policy', owner: 'agent' },
            { title: 'Review it', owner: 'you' },
          ],
          queue: true,
        },
      },
    ])
    expect(screen.getByRole('button', { name: ADDED.title })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: taskEntry.title })).toBeNull()
    expect(screen.getByRole('button', { name: taskEntry.addTask })).toHaveFocus()
    expect(app.calls.sendMessage).toEqual([])

    await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
    expect(screen.getByRole('textbox', { name: taskEntry.title })).toHaveValue('')
  })

  test('Enter in the title adds to the backlog', async () => {
    const app = fakeApp(emptyBoardProps(3), {
      add_task_from_view: actionResult(emptyBoardProps(4), {
        task: ADDED,
        status: 'backlog',
        position: null,
      }),
    })
    const { user } = await renderBoard(app)

    await fillTask(user)
    await user.click(screen.getByRole('textbox', { name: taskEntry.title }))
    await user.keyboard('{Enter}')

    expect(app.callsTo('add_task_from_view')[0].arguments).toMatchObject({ queue: false })
  })

  test('an invalid refusal is shown under the field it names, and the draft is kept', async () => {
    const text = 'steps[1].title must be 1 to 200 characters'
    const app = fakeApp(emptyBoardProps(3), { add_task_from_view: refusal(text) })
    const { user } = await renderBoard(app)

    await fillTask(user)
    await user.click(screen.getByRole('button', { name: taskEntry.add }))

    const field = screen.getByRole('textbox', { name: 'Title of step 2' })
    expect(field).toHaveAccessibleDescription(text)
    expect(field).toHaveValue('Review it')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(app.calls.sendMessage).toEqual([])
  })

  test('any other refusal is shown in the message region', async () => {
    const text = 'The board is busy. Try again.'
    const app = fakeApp(emptyBoardProps(3), { add_task_from_view: refusal(text) })
    const { user } = await renderBoard(app)

    await fillTask(user)
    await user.click(screen.getByRole('button', { name: taskEntry.add }))

    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('textbox', { name: taskEntry.title })).toHaveValue('Add retries')
  })
})

const API_SERVER = { id: 'worker-api-server', name: 'api-server' }
const WEB_CLIENT = { id: 'worker-web-client', name: 'web-client' }

function boardWithWorkers(revision: number, workers: BoardProps['workers']): BoardProps {
  return { ...emptyBoardProps(revision), workers }
}

function workerField() {
  return screen.getByRole('combobox', { name: taskEntry.workerLabel })
}

describe('assigning a task to a worker', () => {
  test('the Worker field lists the live workers of the board', async () => {
    const app = fakeApp(boardWithWorkers(3, [API_SERVER, WEB_CLIENT]), {})
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
    expect(
      within(workerField())
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual([taskEntry.anyWorker, 'api-server', 'web-client'])
  })

  test('with no live worker there is no Worker field', async () => {
    const app = fakeApp(boardWithWorkers(3, []), {})
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
    expect(screen.queryByRole('combobox', { name: taskEntry.workerLabel })).toBeNull()
  })

  test('the chosen worker is sent as assignTo, and the field resets to Any worker after the add', async () => {
    const workers = [API_SERVER, WEB_CLIENT]
    const app = fakeApp(boardWithWorkers(3, workers), {
      add_task_from_view: actionResult(boardWithWorkers(4, workers), {
        task: { ...ADDED, assignedTo: WEB_CLIENT },
        status: 'queue',
        position: 1,
      }),
    })
    const { user } = await renderBoard(app)

    await fillTask(user)
    await user.selectOptions(workerField(), 'web-client')
    await user.click(screen.getByRole('button', { name: taskEntry.addToQueue }))

    expect(app.callsTo('add_task_from_view')[0].arguments).toEqual({
      title: 'Add retries',
      steps: [
        { title: 'Write the policy', owner: 'agent' },
        { title: 'Review it', owner: 'you' },
      ],
      queue: true,
      assignTo: 'worker-web-client',
    })

    await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
    expect(workerField()).toHaveValue('')
  })

  test('Any worker sends no assignTo', async () => {
    const app = fakeApp(boardWithWorkers(3, [API_SERVER]), {
      add_task_from_view: actionResult(boardWithWorkers(4, [API_SERVER]), {
        task: ADDED,
        status: 'backlog',
        position: null,
      }),
    })
    const { user } = await renderBoard(app)

    await fillTask(user)
    await user.click(screen.getByRole('button', { name: taskEntry.add }))

    expect(app.callsTo('add_task_from_view')[0].arguments).not.toHaveProperty('assignTo')
  })

  test('a chosen worker that ends drops out of the list with a newer board, and the field falls back to Any worker', async () => {
    const app = fakeApp(boardWithWorkers(3, [API_SERVER, WEB_CLIENT]), {
      add_task_from_view: actionResult(boardWithWorkers(5, [API_SERVER]), {
        task: ADDED,
        status: 'backlog',
        position: null,
      }),
    })
    const { user, source } = await renderBoard(app)

    await fillTask(user)
    await user.selectOptions(workerField(), 'web-client')
    /* The board a poll brings once web-client has ended. */
    act(() => source.replace(boardWithWorkers(4, [API_SERVER])))

    expect(workerField()).toHaveValue('')
    expect(screen.queryByRole('option', { name: 'web-client' })).toBeNull()

    await user.click(screen.getByRole('button', { name: taskEntry.add }))
    expect(app.callsTo('add_task_from_view')[0].arguments).not.toHaveProperty('assignTo')
  })
})

describe('declaring an output format on your steps', () => {
  test('the Output field is shown only on your steps, is cleared when the owner becomes an agent, and is sent per step', async () => {
    const app = fakeApp(emptyBoardProps(3), {
      add_task_from_view: actionResult(emptyBoardProps(4), {
        task: ADDED,
        status: 'backlog',
        position: null,
      }),
    })
    const { user } = await renderBoard(app)

    await fillTask(user)
    expect(screen.queryByRole('combobox', { name: 'Output of step 1' })).toBeNull()
    const output = screen.getByRole('combobox', { name: 'Output of step 2' })
    expect(output).toHaveValue('')
    await user.selectOptions(output, 'Pull request')
    expect(output).toHaveValue('pull_request')

    const second = screen.getByRole('group', { name: 'Owner of step 2' })
    await user.click(within(second).getByRole('radio', { name: 'Agent' }))
    expect(screen.queryByRole('combobox', { name: 'Output of step 2' })).toBeNull()
    await user.click(within(second).getByRole('radio', { name: 'You' }))
    expect(screen.getByRole('combobox', { name: 'Output of step 2' })).toHaveValue('')

    await user.click(screen.getByRole('button', { name: taskEntry.addStep }))
    await user.type(screen.getByRole('textbox', { name: 'Title of step 3' }), 'File the ticket')
    const third = screen.getByRole('group', { name: 'Owner of step 3' })
    await user.click(within(third).getByRole('radio', { name: 'You' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Output of step 3' }), 'Ticket')
    await user.click(screen.getByRole('button', { name: taskEntry.add }))

    expect(app.callsTo('add_task_from_view')[0].arguments).toEqual({
      title: 'Add retries',
      steps: [
        { title: 'Write the policy', owner: 'agent' },
        { title: 'Review it', owner: 'you' },
        { title: 'File the ticket', owner: 'you', outputFormat: 'ticket' },
      ],
      queue: false,
    })
  })
})

describe('queueing a backlog task', () => {
  test('Queue → calls queue_task_from_view with the display id and draws the result', async () => {
    const app = fakeApp(boardWithBacklog(3, [BACKLOGGED]), {
      queue_task_from_view: actionResult(boardWithBacklog(4, []), {
        task: BACKLOGGED.task,
        status: 'queue',
        position: 2,
      }),
    })
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: backlogWords.toQueue.replace(' →', '') }))
    await act(() => Promise.resolve())

    expect(app.callsTo('queue_task_from_view')).toEqual([
      { name: 'queue_task_from_view', arguments: { task: 'T-003' } },
    ])
    expect(screen.queryByRole('button', { name: BACKLOGGED.task.title })).toBeNull()
  })
})

describe('taskEntryFieldOf', () => {
  test.each([
    ['title must be 1 to 200 characters', { kind: 'title' }],
    ['steps must be 1 to 20 steps', { kind: 'steps' }],
    ['steps[3].title must be 1 to 200 characters', { kind: 'step-title', index: 3 }],
    ['steps[0].detail must be at most 4,000 characters', { kind: 'step-detail', index: 0 }],
    ['steps[2].owner must be agent or you', { kind: 'steps' }],
    ['The board is busy. Try again.', null],
    ['T-012 was archived', null],
  ])('%s', (sentence, field) => {
    expect(taskEntryFieldOf(sentence)).toEqual(field)
  })
})
