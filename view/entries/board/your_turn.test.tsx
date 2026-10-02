import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import type { ActionResult, BoardProps, YourTurnItem } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { yourTurn } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const WAITING = '2026-03-12T09:30:00.000Z'

const YOUR_STEP: YourTurnItem = {
  task: { id: 'task-12', displayId: 'T-012', title: 'Ship the retries' },
  step: { number: 2, title: 'Review the PR', owner: 'you', waitingSince: WAITING },
  steps: [],
  canAct: { complete: true, park: true },
}

const QUESTION: YourTurnItem = {
  task: { id: 'task-14', displayId: 'T-014', title: 'Cache the sessions' },
  step: {
    number: 3,
    title: 'Pick a cache',
    owner: 'agent',
    question: 'Redis or in-process?',
    waitingSince: WAITING,
  },
  session: { id: 'session-a', name: 'api-server' },
  steps: [],
  canAct: { answer: true, park: true },
}

function board(revision: number, yourTurnItems: YourTurnItem[]): BoardProps {
  return {
    ...emptyBoardProps(revision),
    yourTurn: yourTurnItems,
    counts: { yourTurn: yourTurnItems.length, working: 0, queue: 0, toSignOff: 0 },
  }
}

function written(props: BoardProps, item: YourTurnItem): CallToolResult {
  const structuredContent: ActionResult = {
    ...props,
    acted: { task: item.task, status: 'active', position: null },
  }
  return { content: [{ type: 'text', text: 'Done' }], structuredContent }
}

/**
 * A fake App whose get_board gives a board with both cards and then no
 * change, and whose writes give the answer given.
 */
function fakeApp(write: CallToolResult) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      if (params.name !== 'get_board') {
        return write
      }
      const since = params.arguments?.sinceRevision as number | undefined
      return since === undefined
        ? boardResult(board(3, [YOUR_STEP, QUESTION]))
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
  return userEvent.setup()
}

describe('your actions on Your turn', () => {
  test('Mark done calls complete_my_step with the note, redraws from the result and posts nothing', async () => {
    const app = fakeApp(written(board(4, [QUESTION]), YOUR_STEP))
    const user = await renderBoard(app)

    await user.type(screen.getByRole('textbox', { name: yourTurn.noteLabel }), ' Merged ')
    await user.click(screen.getByRole('button', { name: yourTurn.markDone }))

    expect(app.callsTo('complete_my_step')).toEqual([
      { name: 'complete_my_step', arguments: { task: 'T-012', note: 'Merged' } },
    ])
    expect(screen.queryByText(YOUR_STEP.task.title)).toBeNull()
    expect(app.callsTo('get_board')).toHaveLength(1)
    expect(app.calls.sendMessage).toEqual([])
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: yourTurn.title })
    )
  })

  test('Mark done without a note leaves the note out', async () => {
    const app = fakeApp(written(board(4, [QUESTION]), YOUR_STEP))
    const user = await renderBoard(app)

    await user.click(screen.getByRole('button', { name: yourTurn.markDone }))

    expect(app.callsTo('complete_my_step')[0].arguments).toEqual({ task: 'T-012' })
    expect(app.calls.sendMessage).toEqual([])
  })

  test('Answer calls answer_question with the answer and posts nothing', async () => {
    const app = fakeApp(written(board(4, [YOUR_STEP]), QUESTION))
    const user = await renderBoard(app)

    await user.type(screen.getByRole('textbox', { name: yourTurn.answerLabel }), 'Redis ')
    await user.click(screen.getByRole('button', { name: yourTurn.answer }))

    expect(app.callsTo('answer_question')).toEqual([
      { name: 'answer_question', arguments: { task: 'T-014', answer: 'Redis' } },
    ])
    expect(screen.queryByText(QUESTION.task.title)).toBeNull()
    expect(app.callsTo('get_board')).toHaveLength(1)
    expect(app.calls.sendMessage).toEqual([])
  })

  test('Park, confirmed, calls move_to_backlog and posts nothing', async () => {
    const app = fakeApp(written(board(4, [QUESTION]), YOUR_STEP))
    const user = await renderBoard(app)

    const card = screen.getByRole('button', { name: YOUR_STEP.task.title }).closest('li')!
    await user.click(within(card).getByRole('button', { name: yourTurn.park }))
    await user.click(within(card).getByRole('button', { name: yourTurn.park }))

    expect(app.callsTo('move_to_backlog')).toEqual([
      { name: 'move_to_backlog', arguments: { task: 'T-012' } },
    ])
    expect(screen.queryByText(YOUR_STEP.task.title)).toBeNull()
    expect(app.calls.sendMessage).toEqual([])
  })

  test('a refusal posts nothing, keeps the card and the draft, and shows the refusal', async () => {
    const app = fakeApp({
      content: [{ type: 'text', text: 'Step 3 of T-014 is not the current step' }],
      isError: true,
    })
    const user = await renderBoard(app)

    await user.type(screen.getByRole('textbox', { name: yourTurn.answerLabel }), 'Redis')
    await user.click(screen.getByRole('button', { name: yourTurn.answer }))

    expect(app.calls.sendMessage).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Step 3 of T-014 is not the current step')
    expect(screen.getByRole('textbox', { name: yourTurn.answerLabel })).toHaveValue('Redis')
    expect(screen.getByRole('button', { name: yourTurn.answer })).toBeEnabled()
  })
})
