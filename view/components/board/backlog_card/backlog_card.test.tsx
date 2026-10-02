// Copied from anachoic inertia/components/board/backlog_card/backlog_card.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { BACKLOG } from '../../fixtures/board_sections'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { BacklogCard, type BacklogCardProps } from './backlog_card'

const [RENAME] = BACKLOG.busy

/**
 * A spacing token's length, as a computed style writes it.
 */
function space(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function renderCard(props: Partial<BacklogCardProps> = {}) {
  const onOpenTask = vi.fn()
  const onQueueTask = vi.fn()
  const task = props.task ?? RENAME
  const result = renderComponent(
    <div style={{ width: 600 }}>
      <BacklogCard task={task} onOpenTask={onOpenTask} onQueueTask={onQueueTask} {...props} />
    </div>
  )
  const title = screen.getByRole('button', { name: task.task.title })
  const card = title.parentElement?.parentElement as HTMLElement
  return { ...result, onOpenTask, onQueueTask, title, card }
}

describe('BacklogCard', () => {
  test('pressing "Queue →" raises onQueueTask and does not raise onOpenTask', async () => {
    const { user, onOpenTask, onQueueTask } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Queue' }))

    expect(onQueueTask).toHaveBeenCalledExactlyOnceWith(RENAME.task.id)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('"Queue →" pressed from the keyboard does not open the task either', async () => {
    const { user, onOpenTask, onQueueTask } = renderCard()

    screen.getByRole('button', { name: 'Queue' }).focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onQueueTask).toHaveBeenCalledTimes(2)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('the title opens the task', async () => {
    const { user, title, onOpenTask, onQueueTask } = renderCard()

    await user.click(title)

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(RENAME.task.id)
    expect(onQueueTask).not.toHaveBeenCalled()
  })

  test('the meta line reads the id, the steps and how many are yours', () => {
    const { card } = renderCard()

    expect(card).toHaveTextContent('T-003 · 2 steps · 1 for you')
  })

  test('the arrow is hidden, so the button is named "Queue"', () => {
    renderCard()
    const button = screen.getByRole('button', { name: 'Queue' })

    expect(button).toHaveTextContent(/^Queue\s*→$/)
    expect(button.querySelector('[aria-hidden="true"]')).toHaveTextContent('→')
    expect(button).toHaveAccessibleDescription(RENAME.task.title)
  })

  test('a task that cannot be queued has no "Queue →"', () => {
    renderCard({ task: BACKLOG.cannotQueue })

    expect(screen.queryByRole('button', { name: 'Queue' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  test('card padding --space-3, gap --space-2, and the fill on hover', async () => {
    const { card, title } = renderCard()
    const style = getComputedStyle(card)

    expect(style.paddingTop).toBe(space('--space-3'))
    expect(style.rowGap).toBe(space('--space-2'))
    await userEvent.hover(title)
    expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))
  })
})
