import { act, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { HISTORY } from '../../fixtures/history'
import { FILTER_DELAY_MS } from '../../helpers/history'
import { history as words } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { HistoryPage } from '../board_data'
import { HistoryView, type HistoryViewProps } from './history_view'

function renderView(props: Partial<HistoryViewProps> = {}) {
  const handlers = {
    onPageChange: vi.fn(),
    onFilterChange: vi.fn(),
    onOpenTask: vi.fn(),
    onOpenLink: vi.fn(),
  }
  const element = (overrides: Partial<HistoryViewProps> = {}) => (
    <HistoryView history={HISTORY.onePage} {...handlers} {...props} {...overrides} />
  )
  const rendered = renderComponent(element())
  return { ...rendered, ...handlers, element }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('HistoryView', () => {
  test('the header reads "History" and the count, over the table', () => {
    renderView({ history: HISTORY.secondOfThree })

    expect(screen.getByRole('heading', { level: 1, name: words.title })).toBeVisible()
    expect(screen.getByText('45 completed tasks')).toBeVisible()
    expect(screen.getByRole('table', { name: words.title })).toBeVisible()
    expect(screen.getAllByRole('row')).toHaveLength(21)
    expect(screen.getByRole('status')).toHaveTextContent('Page 2 of 3')
  })

  test('one task is counted in the singular, and one page draws no Pagination', () => {
    renderView({ history: HISTORY.filtered, filter: 'flaky' })

    expect(screen.getByText('1 completed task')).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
    expect(screen.getByRole('textbox', { name: words.filterLabel })).toHaveValue('flaky')
  })

  test('with no completed tasks it says so; with a filter that matches nothing it says that', () => {
    const { rerender, element } = renderView({ history: HISTORY.empty })
    expect(screen.getByText(words.emptyYet)).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()

    rerender(element({ history: HISTORY.noMatch }))
    expect(screen.getByText(words.emptyMatch)).toBeVisible()
  })

  test('before the first page arrives it shows that the history is loading', () => {
    renderView({ history: null })

    expect(screen.getByText('Loading history…')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  test('Next asks for the next page, and focus moves to the title when it arrives', async () => {
    const { user, onPageChange, rerender, element } = renderView({
      history: HISTORY.firstOfThree,
    })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    rerender(element({ history: HISTORY.firstOfThree, busy: true }))
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-busy', 'true')

    rerender(element({ history: HISTORY.secondOfThree, busy: false }))
    expect(screen.getByRole('status')).toHaveTextContent('Page 2 of 3')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  test('the filter applies once typing has stopped for 300 ms, once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { onFilterChange } = renderView()
    const field = screen.getByRole('textbox', { name: words.filterLabel })

    for (const text of ['f', 'fl', 'fla']) {
      await act(async () => {
        field.focus()
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(field, text)
        field.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => vi.advanceTimersByTime(FILTER_DELAY_MS - 1))
    }
    expect(onFilterChange).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(1))
    expect(onFilterChange).toHaveBeenCalledOnce()
    expect(onFilterChange).toHaveBeenCalledWith('fla')
  })

  test('a page that arrives for a new filter leaves focus in the field', async () => {
    const { user, rerender, element } = renderView({ history: HISTORY.firstOfThree })
    const field = screen.getByRole('textbox', { name: words.filterLabel })

    await user.type(field, 'flaky')
    const filtered: HistoryPage = HISTORY.filtered
    rerender(element({ history: filtered }))
    expect(field).toHaveFocus()
  })

  test('a title opens its task, and an artifact link asks the host to open it', async () => {
    const { user, onOpenTask, onOpenLink } = renderView()
    const [flaky] = HISTORY.onePage.rows

    await user.click(screen.getByRole('button', { name: flaky.task.title }))
    expect(onOpenTask).toHaveBeenCalledWith(flaky.task.id)

    const row = screen.getByRole('button', { name: flaky.task.title }).closest('tr')!
    await user.click(within(row).getByRole('link', { name: /Ticket/ }))
    expect(onOpenLink).toHaveBeenCalledWith(flaky.artifacts[1].url)
  })

  test('"Back to board" shows only with onBackToBoard, and focus starts on the title when asked', async () => {
    const onBackToBoard = vi.fn()
    const { user } = renderView({ onBackToBoard, focusOnShow: true })

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: words.backToBoard }))
    expect(onBackToBoard).toHaveBeenCalledOnce()
  })

  test('without onBackToBoard there is no way back, and focus is left alone', () => {
    renderView()

    expect(screen.queryByRole('button', { name: words.backToBoard })).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus()
  })
})
