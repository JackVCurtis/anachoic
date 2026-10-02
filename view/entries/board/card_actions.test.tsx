import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import type {
  ActionResult,
  BacklogItem,
  BoardProps,
  QueueItem,
  ToSignOffItem,
} from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { done, queue as queueWords } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const FINISHED: ToSignOffItem = {
  task: { id: 'task-6', displayId: 'T-006', title: 'Fix the flaky login test' },
  finishedAt: '2026-03-12T08:05:00.000Z',
  agentSeconds: 840,
  yourSeconds: 360,
  linkCount: 2,
  steps: [
    { id: 's1', owner: 'agent', status: 'done', title: 'Find the flake', sessionName: null },
    { id: 's2', owner: 'you', status: 'done', title: 'Review the fix', sessionName: null },
  ],
  canAct: { signOff: true, followUp: true, archive: true },
}

const QUEUED: QueueItem = {
  task: { id: 'task-15', displayId: 'T-015', title: 'Add retries' },
  position: 1,
  nextOwner: 'agent',
  steps: [],
  canAct: { reorder: true, backlog: true },
}

const BACKLOGGED: BacklogItem = {
  task: { id: 'task-8', displayId: 'T-008', title: 'Rename the queue' },
  steps: [],
  canAct: { queue: true, archive: true },
}

const FIRST: BoardProps = {
  ...emptyBoardProps(3),
  queue: [QUEUED],
  backlog: [BACKLOGGED],
  toSignOff: [FINISHED],
  counts: { yourTurn: 0, working: 0, queue: 1, toSignOff: 1 },
}

/** The board after an action, which no longer shows any of the three tasks. */
const AFTER = emptyBoardProps(4)

function actionResult(acted: ActionResult['acted']): CallToolResult {
  const structuredContent: ActionResult = { ...AFTER, acted }
  return { content: [{ type: 'text', text: 'Done' }], structuredContent }
}

function refusal(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/**
 * A fake App whose get_board gives the board above and then reports no
 * change, and whose other tools give the answers given by name. An answer
 * may be held back until the test lets it go.
 */
function fakeApp(answers: Record<string, CallToolResult | Promise<CallToolResult>>) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      if (params.name !== 'get_board') {
        return answers[params.name]
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

function cardOf(title: string): HTMLElement {
  const titleButton = screen.getByRole('button', { name: title })
  return (titleButton.closest('article') ?? titleButton.closest('li')) as HTMLElement
}

async function settle() {
  await act(() => Promise.resolve())
}

describe('the card actions', () => {
  test('Sign off calls sign_off with the display id, draws the result and posts nothing', async () => {
    const app = fakeApp({
      sign_off: actionResult({ task: FINISHED.task, status: 'done', position: null }),
    })
    const { user } = await renderBoard(app)

    await user.click(within(cardOf(FINISHED.task.title)).getByRole('button', { name: 'Sign off' }))
    await settle()

    expect(app.callsTo('sign_off')).toEqual([{ name: 'sign_off', arguments: { task: 'T-006' } }])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.queryByRole('button', { name: FINISHED.task.title })).toBeNull()
  })

  test('a follow-up placed at the front calls add_follow_up_from_view with its steps and posts nothing', async () => {
    const app = fakeApp({
      add_follow_up_from_view: actionResult({ task: FINISHED.task, status: 'queue', position: 1 }),
    })
    const { user } = await renderBoard(app)
    const card = cardOf(FINISHED.task.title)

    await user.click(within(card).getByRole('button', { name: 'Follow up' }))
    await user.keyboard('Fix the second flake')
    await user.click(within(card).getByRole('button', { name: 'Add step' }))
    await user.keyboard('Check the nightly run')
    await user.click(
      within(within(card).getByRole('group', { name: 'Owner of step 4' })).getByRole('radio', {
        name: 'You',
      })
    )
    await user.click(within(card).getByRole('radio', { name: done.placementFirst }))
    await user.click(within(card).getByRole('button', { name: done.appendAndQueue }))
    await settle()

    expect(app.callsTo('add_follow_up_from_view')).toEqual([
      {
        name: 'add_follow_up_from_view',
        arguments: {
          task: 'T-006',
          steps: [
            { title: 'Fix the second flake', owner: 'agent' },
            { title: 'Check the nightly run', owner: 'you' },
          ],
          placement: 'first',
        },
      },
    ])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.queryByRole('form', { name: done.followUpTitle })).toBeNull()
  })

  test('one follow-up step is named in the singular', async () => {
    const app = fakeApp({
      add_follow_up_from_view: actionResult({ task: FINISHED.task, status: 'queue', position: 2 }),
    })
    const { user } = await renderBoard(app)
    const card = cardOf(FINISHED.task.title)

    await user.click(within(card).getByRole('button', { name: 'Follow up' }))
    await user.keyboard('Fix the second flake')
    await user.click(within(card).getByRole('button', { name: done.appendAndQueue }))
    await settle()

    expect(app.callsTo('add_follow_up_from_view')[0].arguments).toMatchObject({
      placement: 'last',
    })
    expect(app.calls.sendMessage).toEqual([])
  })

  test('a confirmed Archive on a Done card calls archive_task and posts nothing', async () => {
    const app = fakeApp({
      archive_task: actionResult({ task: FINISHED.task, status: 'done', position: null }),
    })
    const { user } = await renderBoard(app)
    const card = cardOf(FINISHED.task.title)

    await user.click(within(card).getByRole('button', { name: 'Archive' }))
    expect(app.callsTo('archive_task')).toEqual([])
    await user.click(
      within(within(card).getByRole('group')).getByRole('button', { name: 'Archive' })
    )
    await settle()

    expect(app.callsTo('archive_task')).toEqual([
      { name: 'archive_task', arguments: { task: 'T-006' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
  })

  test('Move to backlog on a Queue card calls move_to_backlog once and posts nothing', async () => {
    const app = fakeApp({
      move_to_backlog: actionResult({ task: QUEUED.task, status: 'backlog', position: null }),
    })
    const { user } = await renderBoard(app)

    await user.click(
      within(cardOf(QUEUED.task.title)).getByRole('button', { name: queueWords.toBacklog })
    )
    await settle()

    expect(app.callsTo('move_to_backlog')).toEqual([
      { name: 'move_to_backlog', arguments: { task: 'T-015' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
  })

  test('a confirmed Archive on a Backlog card calls archive_task once and posts nothing', async () => {
    const app = fakeApp({
      archive_task: actionResult({ task: BACKLOGGED.task, status: 'backlog', position: null }),
    })
    const { user } = await renderBoard(app)
    const card = cardOf(BACKLOGGED.task.title)

    await user.click(within(card).getByRole('button', { name: 'Archive' }))
    await user.click(
      within(within(card).getByRole('group')).getByRole('button', { name: 'Archive' })
    )
    await settle()

    expect(app.callsTo('archive_task')).toEqual([
      { name: 'archive_task', arguments: { task: 'T-008' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
  })

  test('the button that started an action is busy, and the card’s others disabled, until the result', async () => {
    let answer!: (result: CallToolResult) => void
    const held = new Promise<CallToolResult>((resolve) => {
      answer = resolve
    })
    const app = fakeApp({ sign_off: held })
    const { user } = await renderBoard(app)
    const card = cardOf(FINISHED.task.title)

    await user.click(within(card).getByRole('button', { name: 'Sign off' }))

    expect(within(card).getByRole('button', { name: 'Sign off' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(within(card).getByRole('button', { name: 'Follow up' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Archive' })).toBeDisabled()

    answer(refusal('T-006 is not finished'))
    await settle()
    expect(within(card).getByRole('button', { name: 'Sign off' })).not.toHaveAttribute('aria-busy')
    expect(within(card).getByRole('button', { name: 'Follow up' })).toBeEnabled()
  })

  test('a refused follow-up sends nothing, is shown in the message region, and keeps the draft', async () => {
    const text = 'T-006 was archived'
    const app = fakeApp({ add_follow_up_from_view: refusal(text) })
    const { user } = await renderBoard(app)
    const card = cardOf(FINISHED.task.title)

    await user.click(within(card).getByRole('button', { name: 'Follow up' }))
    await user.keyboard('Fix the second flake')
    await user.click(within(card).getByRole('radio', { name: done.placementFirst }))
    await user.click(within(card).getByRole('button', { name: done.appendAndQueue }))
    await settle()

    expect(app.callsTo('add_follow_up_from_view')).toHaveLength(1)
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    const form = within(cardOf(FINISHED.task.title)).getByRole('form', {
      name: done.followUpTitle,
    })
    expect(within(form).getByRole('textbox', { name: 'Title of step 3' })).toHaveValue(
      'Fix the second flake'
    )
    expect(within(form).getByRole('radio', { name: done.placementFirst })).toBeChecked()
  })

  test.each([
    ['sign_off', 'Sign off'],
    ['move_to_backlog', queueWords.toBacklog],
  ])('a refused %s sends nothing', async (tool, label) => {
    const app = fakeApp({ [tool]: refusal('No.') })
    const { user } = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: label }))
    await settle()

    expect(app.callsTo(tool)).toHaveLength(1)
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('No.')
  })
})
