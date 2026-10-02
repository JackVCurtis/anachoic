import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import {
  ASKING,
  BLOCKED,
  DONE,
  LONG_TITLE,
  RUNNING,
  TEN_LINKS,
  TWELVE_STEPS,
} from '../../fixtures/task'
import {
  innerScrollRegions,
  MIN_TARGET,
  targetSize,
  unhiddenSymbols,
} from '../../testing/conformance'
import { renderComponent } from '../../testing/render'
import { VIEW_WIDTHS, ViewFrame, windowOverflow, type ViewWidth } from '../../testing/view_frame'
import type { TaskViewData } from '../task_data'
import { TaskView, type TaskViewProps } from './task_view'

const WIDTHS = Object.keys(VIEW_WIDTHS) as ViewWidth[]

const SAMPLES = { RUNNING, ASKING, BLOCKED, DONE, LONG_TITLE, TEN_LINKS, TWELVE_STEPS }

/** The task view in the board, with every action and display button it can show. */
function workedView(data: TaskViewData, next: Partial<TaskViewProps> = {}): TaskViewProps {
  return {
    task: data.task,
    data,
    displayMode: 'inline',
    fullscreenAvailable: true,
    onRequestDisplayMode: vi.fn(),
    onBackToBoard: vi.fn(),
    onOpenLink: vi.fn(),
    onPark: vi.fn(),
    onArchive: vi.fn(),
    messages: [{ id: 'm1', kind: 'error', text: 'T-031 is not active' }],
    onDismissMessage: vi.fn(),
    ...next,
  }
}

async function renderAt(width: ViewWidth, ui: ReactElement) {
  await page.viewport(VIEW_WIDTHS[width], 900)
  return renderComponent(<ViewFrame width={width}>{ui}</ViewFrame>)
}

afterEach(async () => {
  await page.viewport(414, 896)
})

describe('the task view against 07 and anachoic ui/16', () => {
  test.each(WIDTHS.flatMap((width) => Object.keys(SAMPLES).map((name) => [width, name] as const)))(
    'has no sideways scroll and no inner scroll region, %s, %s',
    async (width, name) => {
      const data = SAMPLES[name as keyof typeof SAMPLES]
      const { container } = await renderAt(width, <TaskView {...workedView(data)} />)

      const [sideways] = await windowOverflow()
      expect(sideways).toBe(0)
      expect(innerScrollRegions(container)).toEqual([])
    }
  )

  test.each(Object.keys(SAMPLES))(
    'every character that is not a word is hidden from assistive technology, %s',
    async (name) => {
      const data = SAMPLES[name as keyof typeof SAMPLES]
      const { container } = await renderAt('inline', <TaskView {...workedView(data)} />)

      expect(unhiddenSymbols(container)).toEqual([])
    }
  )

  test.each([
    ['Back to board', {}],
    ['Open in full screen', {}],
    ['Back to inline', { displayMode: 'fullscreen' as const }],
    ['Park', {}],
    ['Archive', {}],
    ['Dismiss', {}],
  ])('“%s” is a target of at least 24 by 24 px', async (name, next) => {
    await renderAt('inline', <TaskView {...workedView(RUNNING, next)} />)

    const size = targetSize(screen.getByRole('button', { name }))
    expect(size.width, JSON.stringify(size)).toBeGreaterThanOrEqual(MIN_TARGET)
    expect(size.height, JSON.stringify(size)).toBeGreaterThanOrEqual(MIN_TARGET)
  })
})
