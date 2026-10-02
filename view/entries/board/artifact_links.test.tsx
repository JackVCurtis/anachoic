import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { BoardProps } from '../../../shared/props'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { assistive, card } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard } from './board_entry'

const PR = 'https://github.com/acme/billing/pull/412'
const TICKET = 'https://acme.atlassian.net/browse/BILL-88'

const FIRST: BoardProps = {
  ...emptyBoardProps(3),
  queue: [
    {
      task: { id: 'task-15', displayId: 'T-015', title: 'Add retries' },
      position: 1,
      nextOwner: 'agent',
      steps: [],
      artifacts: [
        { stepNumber: 2, format: 'pull_request', url: PR },
        { stepNumber: 3, format: 'ticket', url: TICKET },
      ],
      canAct: { reorder: true, backlog: true },
    },
  ],
  counts: { yourTurn: 0, working: 0, queue: 1, toSignOff: 0 },
}

function fakeApp(openLink?: () => Promise<{ isError?: boolean }>) {
  const app = new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      return since === undefined
        ? boardResult(FIRST)
        : boardResult({ changed: false, revision: since })
    },
  })
  if (openLink) {
    app.openLink = async (params) => {
      app.calls.openLink.push(params)
      return openLink()
    }
  }
  return app
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

describe('artifact links on the cards', () => {
  test('each is labelled by its format and step, keeps its address in the title, and opens through the host', async () => {
    const app = fakeApp()
    const user = await renderBoard(app)

    const link = screen.getByRole('link', {
      name: `Pull request · step 2 ${assistive.opensInBrowser}`,
    })
    expect(link).toHaveAttribute('title', PR)
    expect(link).toHaveTextContent('Pull request · step 2 ↗')
    expect(screen.getByRole('link', { name: /^Ticket · step 3/ })).toHaveAttribute('title', TICKET)

    await user.click(link)

    expect(app.calls.openLink).toEqual([{ url: PR }])
    expect(app.calls.sendMessage).toEqual([])
    expect(app.callsTo('get_board')).toHaveLength(1)
  })

  test('a link the host does not open is said in the message region', async () => {
    const app = fakeApp(() => Promise.resolve({ isError: true }))
    const user = await renderBoard(app)

    await user.click(screen.getByRole('link', { name: /^Ticket · step 3/ }))

    expect(app.calls.openLink).toEqual([{ url: TICKET }])
    expect(await screen.findByRole('alert')).toHaveTextContent(card.linkNotOpened)
  })
})

describe('what the entry hands the cards about output formats', () => {
  const HANDED: BoardProps = {
    ...emptyBoardProps(3),
    yourTurn: [
      {
        task: { id: 'task-12', displayId: 'T-012', title: 'Ship the retries' },
        step: {
          number: 2,
          title: 'Review the PR',
          owner: 'you',
          waitingSince: '2026-03-12T09:30:00.000Z',
        },
        input: { stepNumber: 1, format: 'pull_request', url: PR },
        steps: [],
        canAct: { complete: true, park: true },
      },
    ],
    working: [
      {
        task: { id: 'task-16', displayId: 'T-016', title: 'File the follow-up' },
        step: {
          number: 1,
          title: 'File the ticket',
          outputFormat: 'ticket',
          runningSince: '2026-03-12T09:30:00.000Z',
        },
        session: { id: 'session-a', name: 'api-server' },
        steps: [],
      },
    ],
    counts: { yourTurn: 1, working: 1, queue: 0, toSignOff: 0 },
  }

  test("a user step's input link and a running step's output format reach the cards", async () => {
    const app = new FakeApp({
      hostContext: { displayMode: 'inline', timeZone: 'UTC' },
      answer: (params) => {
        const since = params.arguments?.sinceRevision as number | undefined
        return since === undefined
          ? boardResult(HANDED)
          : boardResult({ changed: false, revision: since })
      },
    })
    const user = await renderBoard(app)

    expect(screen.getByText('Produces a ticket')).toBeVisible()
    await user.click(screen.getByRole('link', { name: /^Pull request from step 1/ }))

    expect(app.calls.openLink).toEqual([{ url: PR }])
  })
})
