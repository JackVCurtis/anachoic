import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { DONE } from '../../fixtures/board_sections'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { SignOffTask } from '../board_data'
import { SignOffCard } from './sign_off_card'

function renderCard(task: SignOffTask) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<SignOffCard task={task} onOpenTask={onOpenTask} />)
  return { ...rendered, onOpenTask, card: screen.getByRole('article') }
}

describe('SignOffCard', () => {
  test('the stats line reads "agent 14m · you 6m · 2 links"', () => {
    const { card } = renderCard(DONE.twoLinks)

    expect(card).toHaveTextContent('agent 14m · you 6m · 2 links')
  })

  test('the stats line reads "1 link" for one', () => {
    const { card } = renderCard(DONE.oneLink)

    expect(card).toHaveTextContent('agent 14m · you 6m · 1 link')
  })

  test('the meta row reads the task id and when it finished', () => {
    renderCard(DONE.twoLinks)

    expect(screen.getByText('T-037')).toBeVisible()
    expect(screen.getByText('Finished today 08:05')).toBeVisible()
  })

  test('the card title raises onOpenTask with the task id; the card itself does not', async () => {
    const { user, onOpenTask, card } = renderCard(DONE.flaky)
    const title = screen.getByRole('button', { name: DONE.flaky.task.title })

    expect(title.closest('h3')).not.toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await user.click(card)
    expect(onOpenTask).not.toHaveBeenCalled()

    await user.click(title)
    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(DONE.flaky.task.id)
  })

  test('the title turns to the accent color on hover', async () => {
    renderCard(DONE.flaky)
    const title = screen.getByRole('button', { name: DONE.flaky.task.title })

    await userEvent.hover(title)
    expect(getComputedStyle(title).color).toBe(resolvedColor('--color-text-accent'))
  })

  test('a long title wraps and the card does not widen', () => {
    renderComponent(
      <div style={{ width: 600 }}>
        <SignOffCard task={DONE.longTitle} onOpenTask={() => {}} />
      </div>
    )
    const card = screen.getByRole('article')

    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
    expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(600)
  })
})
