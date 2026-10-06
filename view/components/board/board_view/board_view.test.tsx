import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EMPTY_BOARD_VIEW, numberedTasks } from '../../fixtures/empty_views'
import { assistive, yourTurn } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { ViewFrame } from '../../testing/view_frame'
import type { BacklogTask, QueueTask } from '../board_data'
import { BoardView, type BoardViewProps } from './board_view'

const EMPTY: BoardViewProps = EMPTY_BOARD_VIEW

function renderBoard(props: BoardViewProps = EMPTY) {
  return renderComponent(
    <ViewFrame>
      <BoardView {...props} />
    </ViewFrame>
  )
}

const QUEUE: QueueTask[] = numberedTasks(14).map((task, index) => ({
  task,
  position: index + 1,
  nextOwner: 'agent',
  steps: [],
  canAct: { reorder: true, backlog: true },
}))

const BACKLOG: BacklogTask[] = numberedTasks(14).map((task) => ({
  task,
  steps: [],
  canAct: { queue: true, archive: true },
}))

function section(title: string) {
  return screen.getByRole('heading', { level: 2, name: title }).closest('section')!
}

/**
 * The view's height as auto-resize measures it: the document at its content's
 * height, which here is the frame the view is drawn in.
 */
function viewHeight(container: HTMLElement) {
  return container.firstElementChild!.getBoundingClientRect().height
}

afterEach(async () => {
  await page.viewport(414, 896)
})

describe('BoardView', () => {
  test('renders an empty board with one hidden h1 and the sections in order', () => {
    renderBoard()

    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe(assistive.boardTitle)
    expect(h1[0].getBoundingClientRect().height).toBeLessThanOrEqual(1)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Waiting on user',
      'Idle',
      'Working',
      'Queue',
      'Backlog',
      'Done',
    ])
  })

  test('each empty section counts 0, and Waiting on user has a header like the others', () => {
    renderBoard()

    for (const title of ['Waiting on user', 'Idle', 'Working', 'Queue', 'Backlog', 'Done']) {
      expect(within(section(title)).getByText('0')).toBeTruthy()
    }
    const yourTurnHeading = screen.getByRole('heading', { level: 2, name: 'Waiting on user' })
    expect(yourTurnHeading.closest('[data-tone]')).toBeNull()
    const idleHeading = screen.getByRole('heading', { level: 2, name: 'Idle' })
    expect(getComputedStyle(yourTurnHeading).color).toBe(getComputedStyle(idleHeading).color)
    expect(getComputedStyle(yourTurnHeading.nextElementSibling!).color).toBe(
      getComputedStyle(idleHeading.nextElementSibling!).color
    )
    expect(within(section('Waiting on user')).getByText(yourTurn.nothingWaiting)).toBeTruthy()
    expect(within(section('Done')).getByText('Nothing waiting for sign-off')).toBeTruthy()
    expect(within(section('Queue')).queryByRole('list')).toBeNull()
    expect(section('Queue').children).toHaveLength(1)
    expect(section('Backlog').children).toHaveLength(1)
  })

  test('has a Messages region and one polite live region', () => {
    const { container } = renderBoard()

    expect(screen.getByRole('region', { name: assistive.landmarkMessages })).toBeTruthy()
    const live = container.querySelectorAll('[aria-live]')
    expect(live).toHaveLength(1)
    expect(live[0].getAttribute('aria-live')).toBe('polite')
  })

  test('is as tall in a 600 px host frame as in a 2000 px one, and nothing scrolls on its own', async () => {
    await page.viewport(735, 600)
    const { container, unmount } = renderBoard()
    await document.fonts.ready
    const short = viewHeight(container)
    const overflowing = [...container.querySelectorAll('*')].filter((element) => {
      const { overflowX, overflowY } = getComputedStyle(element)
      return [overflowX, overflowY].some((value) => value === 'auto' || value === 'scroll')
    })
    unmount()

    await page.viewport(735, 2000)
    const second = renderBoard()
    await document.fonts.ready
    const tall = viewHeight(second.container)

    expect(short).toBeGreaterThan(0)
    expect(tall).toBe(short)
    expect(overflowing).toEqual([])
  })

  test('the padding gives way to larger safe-area insets', () => {
    const { container } = renderBoard({
      ...EMPTY,
      safeAreaInsets: { top: 40, right: 2, bottom: 2, left: 32 },
    })
    const board = container.firstElementChild!.firstElementChild as HTMLElement
    const style = getComputedStyle(board)

    expect(style.paddingTop).toBe('40px')
    expect(style.paddingLeft).toBe('32px')
    expect(Number.parseFloat(style.paddingRight)).toBeCloseTo(20.4)
    expect(Number.parseFloat(style.paddingBottom)).toBeCloseTo(13.6)
  })

  test('a backlog of 14 shows 8 and a Show all 14 disclosure, which shows the rest', async () => {
    const { user } = renderBoard({ ...EMPTY, backlog: BACKLOG })
    const backlog = section('Backlog')

    expect(within(backlog).getAllByRole('listitem')).toHaveLength(8)
    const toggle = within(backlog).getByRole('button', { name: 'Show all 14' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    await user.click(toggle)
    expect(within(backlog).getAllByRole('listitem')).toHaveLength(14)
    expect(within(backlog).getByRole('button', { name: 'Show fewer' })).toBeTruthy()
  })

  test('a queue of 14 shows all 14', () => {
    renderBoard({ ...EMPTY, queue: QUEUE })
    const queue = section('Queue')

    expect(within(queue).getAllByRole('listitem')).toHaveLength(14)
    expect(within(queue).queryByRole('button', { name: /^Show all/ })).toBeNull()
  })
})
