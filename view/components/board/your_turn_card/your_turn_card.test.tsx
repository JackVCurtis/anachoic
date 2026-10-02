import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { YOUR_TURN } from '../../fixtures/board_sections'
import { FIXED_NOW } from '../../fixtures/clock'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { YourTurnTask } from '../board_data'
import { YourTurnCard } from './your_turn_card'

function renderCard(item: YourTurnTask) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<YourTurnCard item={item} onOpenTask={onOpenTask} />)
  const card = screen.getByRole('article')
  return { ...rendered, onOpenTask, card }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('YourTurnCard', () => {
  test('a step owned by you reads "Your step" and shows no question', () => {
    const { card } = renderCard(YOUR_TURN.yourStep)

    expect(screen.getByText('Your step')).toBeVisible()
    expect(screen.getByText(YOUR_TURN.yourStep.task.displayId)).toBeVisible()
    expect(screen.getByText(YOUR_TURN.yourStep.step.title)).toBeVisible()
    expect(screen.getByText('Step 3/4 · 14m')).toBeVisible()
    expect(card.querySelectorAll('p')).toHaveLength(1)
  })

  test("an agent's question shows the session's name and the question text", () => {
    renderCard(YOUR_TURN.question)

    expect(screen.getByText('This chat asks')).toBeVisible()
    expect(screen.getByText('Redis or in-process?')).toBeVisible()
    expect(screen.queryByText('Your step')).toBeNull()
  })

  test('a question with no session named reads "Asks"', () => {
    renderCard({ ...YOUR_TURN.question, sessionName: null })

    expect(screen.getByText('Asks')).toBeVisible()
  })

  test('a question of 2,000 characters is shown in full and does not widen the card', () => {
    renderComponent(
      <div style={{ width: 600 }}>
        <YourTurnCard item={YOUR_TURN.longQuestion} onOpenTask={() => {}} />
      </div>
    )
    const question = YOUR_TURN.longQuestion.step.question!

    expect(question).toHaveLength(2000)
    expect(screen.getByText(question)).toBeVisible()
    const article = screen.getByRole('article')
    expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth)
    expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(600)
  })

  test('the waited time advances from "14m" with the fixed clock at the 30-second tick', () => {
    vi.useFakeTimers({
      now: Date.parse(FIXED_NOW) + 45_000,
      toFake: ['setInterval', 'clearInterval', 'Date'],
    })
    render(<YourTurnCard item={YOUR_TURN.yourStep} onOpenTask={() => {}} />)
    expect(screen.getByText('Step 3/4 · 14m')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText('Step 3/4 · 14m')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText('Step 3/4 · 15m')).toBeDefined()
  })

  test('pressing the title raises onOpenTask with the task id', async () => {
    const { user, onOpenTask } = renderCard(YOUR_TURN.question)
    const title = screen.getByRole('button', { name: YOUR_TURN.question.task.title })

    expect(title.closest('h3')).not.toBeNull()
    await user.click(title)

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.question.task.id)
  })

  test('the card is inverted, padded --space-4, and does not change on hover', async () => {
    const { card } = renderCard(YOUR_TURN.yourStep)
    const style = getComputedStyle(card)
    const fill = resolvedColor('--color-accent-900')

    expect(card.getAttribute('data-tone')).toBe('inverse')
    expect(style.backgroundColor).toBe(fill)
    expect(style.borderTopColor).toBe(fill)
    expect(style.paddingTop).toBe(
      getComputedStyle(document.documentElement).getPropertyValue('--space-4').trim()
    )
    await userEvent.hover(screen.getByRole('button', { name: YOUR_TURN.yourStep.task.title }))
    expect(getComputedStyle(card).backgroundColor).toBe(fill)
  })
})
