import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { WORKING } from '../../fixtures/board_sections'
import { working } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { WorkingTask } from '../board_data'
import { WorkingSection } from './working_section'

function renderSection(tasks: readonly WorkingTask[]) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<WorkingSection tasks={tasks} onOpenTask={onOpenTask} />)
  const section = screen.getByRole('heading', { level: 2, name: working.title }).closest('section')!
  return { ...rendered, onOpenTask, section }
}

describe('WorkingSection', () => {
  test('one card per task, in the server order, with the count', () => {
    const { section } = renderSection(WORKING.severalSessions)

    expect(within(section).getByText('3')).toBeVisible()
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((title) => title.textContent)
    ).toEqual(WORKING.severalSessions.map(({ task }) => task.title))
  })

  test('with nothing running it shows the empty state', () => {
    const { section } = renderSection([])

    expect(within(section).getByText(working.nothingWorking)).toBeVisible()
  })

  test('twelve cards fold after eight', async () => {
    const { user, section } = renderSection(WORKING.many)

    expect(within(section).getAllByRole('article')).toHaveLength(8)
    await user.click(within(section).getByRole('button', { name: 'Show all 12' }))
    expect(within(section).getAllByRole('article')).toHaveLength(12)
  })

  test('a card title raises onOpenTask with its task id', async () => {
    const { user, onOpenTask } = renderSection(WORKING.severalSessions)
    const [, second] = WORKING.severalSessions

    await user.click(screen.getByRole('button', { name: second.task.title }))

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(second.task.id)
  })
})
