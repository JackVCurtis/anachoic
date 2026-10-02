import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { YOUR_TURN } from '../../fixtures/board_sections'
import { yourTurn } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { YourTurnTask } from '../board_data'
import { YourTurnSection } from './your_turn_section'

function renderSection(tasks: readonly YourTurnTask[]) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<YourTurnSection tasks={tasks} onOpenTask={onOpenTask} />)
  const section = screen
    .getByRole('heading', { level: 2, name: yourTurn.title })
    .closest('section')!
  return { ...rendered, onOpenTask, section }
}

describe('YourTurnSection', () => {
  test('one card per task, in the server order, under a header on the inverse surface', () => {
    const { section } = renderSection([YOUR_TURN.yourStep, YOUR_TURN.question])
    const heading = within(section).getByRole('heading', { level: 2 })

    expect(heading.closest('[data-tone]')?.getAttribute('data-tone')).toBe('inverse')
    expect(within(section).getByText('2')).toBeVisible()
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((title) => title.textContent)
    ).toEqual([YOUR_TURN.yourStep.task.title, YOUR_TURN.question.task.title])
  })

  test('with nothing waiting it shows the dashed empty state', () => {
    const { section } = renderSection([])

    expect(within(section).getByText(yourTurn.nothingWaiting)).toBeVisible()
    expect(within(section).queryByRole('list')).toBeNull()
  })

  test('with 20 cards the section shows 8 and "Show all 20", and opening it shows all 20', async () => {
    const { user, section } = renderSection(YOUR_TURN.many)

    expect(within(section).getAllByRole('article')).toHaveLength(8)
    const toggle = within(section).getByRole('button', { name: 'Show all 20' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    await user.click(toggle)
    expect(within(section).getAllByRole('article')).toHaveLength(20)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  test('a card title raises onOpenTask with its task id', async () => {
    const { user, onOpenTask } = renderSection([YOUR_TURN.yourStep, YOUR_TURN.question])

    await user.click(screen.getByRole('button', { name: YOUR_TURN.yourStep.task.title }))

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.yourStep.task.id)
  })
})
