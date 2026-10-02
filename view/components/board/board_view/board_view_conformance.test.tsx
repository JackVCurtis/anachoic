import { screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { BUSY_BOARD, LONG_TEXT_BOARD } from '../../fixtures/board'
import { EMPTY_BOARD_VIEW } from '../../fixtures/empty_views'
import { HISTORY } from '../../fixtures/history'
import { MESSAGES } from '../../fixtures/messages'
import {
  innerScrollRegions,
  MIN_TARGET,
  targetSize,
  unhiddenSymbols,
} from '../../testing/conformance'
import { renderComponent } from '../../testing/render'
import { VIEW_WIDTHS, ViewFrame, windowOverflow, type ViewWidth } from '../../testing/view_frame'
import { HistoryView } from '../history_view/history_view'
import { BoardView, type BoardViewProps } from './board_view'

const WIDTHS = Object.keys(VIEW_WIDTHS) as ViewWidth[]

/** A board with every section filled, an error strip, and every action wired. */
function workedBoard(board: Partial<BoardViewProps> = BUSY_BOARD): BoardViewProps {
  return {
    ...EMPTY_BOARD_VIEW,
    ...board,
    messages: [MESSAGES.error],
    onDismissMessage: vi.fn(),
    onOpenTask: vi.fn(),
    onQueueTask: vi.fn(),
    onReorder: vi.fn(),
    onMoveToBacklog: vi.fn(),
    onSignOff: vi.fn(),
    onFollowUp: vi.fn(),
    onArchive: vi.fn(),
    onOpenLink: vi.fn(),
    onRemoveSession: vi.fn(),
    onShowHistory: vi.fn(),
    onCompleteStep: vi.fn(),
    onPark: vi.fn(),
    onAnswer: vi.fn(),
  }
}

async function renderAt(width: ViewWidth, ui: React.ReactElement) {
  await page.viewport(VIEW_WIDTHS[width], 900)
  return renderComponent(<ViewFrame width={width}>{ui}</ViewFrame>)
}

afterEach(async () => {
  await page.viewport(414, 896)
})

describe('the board view against 07 and anachoic ui/16', () => {
  test.each(WIDTHS)(
    'a busy board has no sideways scroll and no inner scroll region, %s',
    async (width) => {
      const { container } = await renderAt(width, <BoardView {...workedBoard()} />)

      const [sideways] = await windowOverflow()
      expect(sideways).toBe(0)
      expect(innerScrollRegions(container)).toEqual([])
    }
  )

  test.each(WIDTHS)('a board of long text has no sideways scroll, %s', async (width) => {
    await renderAt(width, <BoardView {...workedBoard(LONG_TEXT_BOARD)} />)

    const [sideways] = await windowOverflow()
    expect(sideways).toBe(0)
  })

  test('every character that is not a word is hidden from assistive technology', async () => {
    const { container } = await renderAt('inline', <BoardView {...workedBoard()} />)

    expect(unhiddenSymbols(container)).toEqual([])
  })

  test.each(['Move', 'Dismiss', 'Park', 'Archive'])(
    'each “%s” button is a target of at least 24 by 24 px',
    async (name) => {
      await renderAt('inline', <BoardView {...workedBoard()} />)

      const buttons = screen.getAllByRole('button', { name: new RegExp(`^${name}\\b`) })
      expect(buttons.length).toBeGreaterThan(0)
      for (const button of buttons) {
        const size = targetSize(button)
        expect(size.width, JSON.stringify(size)).toBeGreaterThanOrEqual(MIN_TARGET)
        expect(size.height, JSON.stringify(size)).toBeGreaterThanOrEqual(MIN_TARGET)
      }
    }
  )
})

describe('the History view against 07 and anachoic ui/16', () => {
  const props = {
    onPageChange: vi.fn(),
    onFilterChange: vi.fn(),
    onOpenTask: vi.fn(),
    onOpenLink: vi.fn(),
  }

  test.each(WIDTHS)(
    'pages of history have no sideways scroll and no inner scroll region, %s',
    async (width) => {
      const { container } = await renderAt(
        width,
        <HistoryView history={HISTORY.secondOfThree} {...props} />
      )

      const [sideways] = await windowOverflow()
      expect(sideways).toBe(0)
      expect(innerScrollRegions(container)).toEqual([])
    }
  )

  test.each(['secondOfThree', 'longText'] as const)(
    'every character that is not a word is hidden, %s',
    async (sample) => {
      const { container } = await renderAt(
        'inline',
        <HistoryView history={HISTORY[sample]} {...props} />
      )

      expect(unhiddenSymbols(container)).toEqual([])
    }
  )
})
