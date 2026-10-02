import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { HistoryProps, HistoryRow } from '../../../shared/props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { historyProps, historyResult } from '../../bridge/testing/history_props'
import { taskProps, taskResult } from '../../bridge/testing/task_props'
import { ViewFrame } from '../../components/testing/view_frame'
import { HistoryEntry, loadHistory } from './history_entry'

const [CACHING] = historyProps().rows

function row(number: number): HistoryRow {
  return {
    ...CACHING,
    task: { id: String(number), displayId: `T-0${number}`, title: `Completed task ${number}` },
  }
}

/**
 * Page `page` of three, of 45 tasks, or the one page a filter matches.
 */
function page(revision: number, number: number, filter = ''): HistoryProps {
  if (filter !== '') {
    return { ...historyProps(revision, 1, filter), total: 1, pageCount: 1 }
  }
  const first = number === 1 ? [CACHING] : []
  const count = number === 3 ? 5 : 20
  return {
    ...historyProps(revision, number),
    pageCount: 3,
    total: 45,
    rows: [
      ...first,
      ...Array.from({ length: count - first.length }, (_, i) => row(100 + number * 20 + i)),
    ],
  }
}

/**
 * A fake App that answers get_history with the page asked for, unchanged
 * when asked since a revision, and get_task with T-012.
 */
function fakeApp(replayedFilter?: string) {
  return new FakeApp({
    hostContext: { displayMode: 'inline', timeZone: 'UTC' },
    replayedResult:
      replayedFilter === undefined ? undefined : historyResult(page(1, 1, replayedFilter)),
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      if (params.name === 'get_task') {
        return since === undefined
          ? taskResult(taskProps(5))
          : taskResult({ changed: false, revision: since })
      }
      if (since !== undefined) {
        return historyResult({ changed: false, revision: since })
      }
      const asked = (params.arguments?.page as number | undefined) ?? 1
      const filter = (params.arguments?.filter as string | undefined) ?? ''
      return historyResult(page(2, asked, filter))
    },
  })
}

async function renderHistory(app: FakeApp) {
  const loaded = await loadHistory({ app })
  render(
    <ViewFrame>
      <HistoryEntry {...loaded} />
    </ViewFrame>
  )
  return { user: userEvent.setup(), loaded }
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

describe('the History entry', () => {
  test('takes only the filter from the replayed result, and fetches the page with get_history', async () => {
    const app = fakeApp('caching')
    const { loaded } = await renderHistory(app)

    expect(loaded.filter).toBe('caching')
    expect(app.callsTo('get_history')[0]).toEqual({
      name: 'get_history',
      arguments: { page: 1, filter: 'caching' },
    })
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveValue('caching')
    expect(screen.getByText('1 completed task')).toBeVisible()
  })

  test('pages move through get_history and announce "Page 2 of 3"', async () => {
    const app = fakeApp('')
    const { user } = await renderHistory(app)
    expect(screen.getByRole('status')).toHaveTextContent('Page 1 of 3')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await settle()

    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 2 })
    expect(screen.getByRole('status')).toHaveTextContent('Page 2 of 3')
    expect(screen.getByRole('button', { name: 'Completed task 140' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toHaveFocus()
  })

  test('the filter fetches the first page again, filtered', async () => {
    const app = fakeApp('')
    const { user } = await renderHistory(app)

    await user.type(screen.getByRole('textbox', { name: 'Filter' }), 'caching')
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)))
    await settle()

    expect(app.callsTo('get_history').at(-1)?.arguments).toEqual({ page: 1, filter: 'caching' })
    expect(screen.getByText('1 completed task')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveFocus()
  })

  test('a title opens the task panel, and Back to history returns focus to the row', async () => {
    const app = fakeApp('')
    const { user } = await renderHistory(app)

    await user.click(screen.getByRole('button', { name: 'Add caching' }))
    await settle()

    expect(app.callsTo('get_task')[0]).toEqual({ name: 'get_task', arguments: { task: '12' } })
    expect(screen.getByRole('heading', { level: 2, name: 'Add caching' })).toHaveFocus()
    expect(screen.queryByRole('heading', { level: 1, name: 'History' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back to board' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back to history' }))
    await settle()

    expect(screen.queryByRole('heading', { level: 2, name: 'Add caching' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add caching' })).toHaveFocus()
  })

  test('an artifact link opens through the host, and nothing is posted to the chat', async () => {
    const app = fakeApp('')
    const { user } = await renderHistory(app)
    const caching = screen.getByRole('button', { name: 'Add caching' }).closest('tr')!

    await user.click(within(caching).getByRole('link', { name: /Pull request/ }))

    expect(app.calls.openLink).toEqual([{ url: 'https://github.com/acme/app/pull/7' }])
    expect(app.calls.sendMessage).toEqual([])
  })

  test('with no replayed result it starts unfiltered', async () => {
    const app = fakeApp()
    const { loaded } = await renderHistory(app)

    expect(loaded.filter).toBe('')
    expect(app.callsTo('get_history')[0].arguments).toEqual({ page: 1 })
  })
})
