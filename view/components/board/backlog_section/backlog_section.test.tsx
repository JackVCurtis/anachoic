import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { BACKLOG } from '../../fixtures/board_sections'
import { backlog } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { BacklogTask } from '../board_data'
import { BacklogSection } from './backlog_section'

function renderSection(tasks: readonly BacklogTask[]) {
  const callbacks = { onOpenTask: vi.fn(), onQueueTask: vi.fn() }
  const rendered = renderComponent(<BacklogSection tasks={tasks} {...callbacks} />)
  const section = screen.getByRole('heading', { level: 2, name: backlog.title }).closest('section')!
  return { ...rendered, ...callbacks, section }
}

describe('BacklogSection', () => {
  test('a Backlog of 14 shows 8 and "Show all 14", which shows the rest', async () => {
    const { user, section } = renderSection(BACKLOG.fourteen)

    expect(within(section).getAllByRole('listitem')).toHaveLength(8)
    await user.click(within(section).getByRole('button', { name: 'Show all 14' }))
    expect(within(section).getAllByRole('listitem')).toHaveLength(14)
  })

  test('an empty Backlog shows the header with 0 and nothing else', () => {
    const { section } = renderSection([])

    expect(section.children).toHaveLength(1)
    expect(within(section).getByText('0')).toBeVisible()
  })

  test('"Queue →" queues its own task and opens nothing', async () => {
    const { user, onOpenTask, onQueueTask } = renderSection(BACKLOG.busy)
    const [, second] = BACKLOG.busy
    const card = screen.getByRole('button', { name: second.task.title }).closest('li')!

    await user.click(within(card).getByRole('button', { name: 'Queue' }))

    expect(onQueueTask).toHaveBeenCalledExactlyOnceWith(second.task.id)
    expect(onOpenTask).not.toHaveBeenCalled()
  })
})
