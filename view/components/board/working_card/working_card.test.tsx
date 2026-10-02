import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { WORKING } from '../../fixtures/board_sections'
import { FIXED_NOW } from '../../fixtures/clock'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { WorkingTask } from '../board_data'
import { WorkingCard } from './working_card'

function renderCard(item: WorkingTask) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<WorkingCard item={item} onOpenTask={onOpenTask} />)
  return { ...rendered, onOpenTask, card: screen.getByRole('article') }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('WorkingCard', () => {
  test('the elapsed time advances from "6m 12s elapsed" to "6m 13s elapsed" with the fixed clock', () => {
    vi.useFakeTimers({
      now: Date.parse(FIXED_NOW),
      toFake: ['setInterval', 'clearInterval', 'Date'],
    })
    render(<WorkingCard item={WORKING.fourSteps} onOpenTask={() => {}} />)
    expect(screen.getByText('6m 12s elapsed')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('6m 13s elapsed')).toBeDefined()
  })

  test('the step line reads "Step 2 of 4 · …" for a four-step chain on step 2', () => {
    renderCard(WORKING.fourSteps)

    expect(screen.getByText('Step 2 of 4 · Draft the migration')).toBeVisible()
    expect(screen.getByText('billing')).toBeVisible()
    expect(screen.getByText('T-031')).toBeVisible()
  })

  test('a card with no note renders no note element', () => {
    const { card } = renderCard(WORKING.noNote)

    expect(card.querySelector('.text-detail')).toBeNull()
    expect(card.querySelectorAll('p')).toHaveLength(1)
  })

  test('a card with a note shows it in full, and a note of 500 characters does not widen the view', () => {
    renderComponent(
      <div style={{ width: 600 }}>
        <WorkingCard item={WORKING.longNote} onOpenTask={() => {}} />
      </div>
    )
    const note = WORKING.longNote.step.note!
    const card = screen.getByRole('article')

    expect(note).toHaveLength(500)
    expect(screen.getByText(note)).toBeVisible()
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
    expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(600)
  })

  test('pressing the title raises onOpenTask with the task id', async () => {
    const { user, onOpenTask } = renderCard(WORKING.one)
    const title = screen.getByRole('button', { name: WORKING.one.task.title })

    expect(title.closest('h3')).not.toBeNull()
    await user.click(title)

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(WORKING.one.task.id)
  })

  test('a light card, padded --space-4, filled --color-accent-100 on hover', async () => {
    const { card } = renderCard(WORKING.one)

    expect(card.closest('[data-tone="inverse"]')).toBeNull()
    expect(getComputedStyle(card).paddingTop).toBe(
      getComputedStyle(document.documentElement).getPropertyValue('--space-4').trim()
    )
    await userEvent.hover(screen.getByRole('button', { name: WORKING.one.task.title }))
    expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))
  })

  test('the pips name the session that holds the step', () => {
    renderCard(WORKING.fourSteps)

    expect(
      screen.getByRole('img').querySelector('[title="billing · Draft the migration"]')
    ).not.toBeNull()
  })
})
