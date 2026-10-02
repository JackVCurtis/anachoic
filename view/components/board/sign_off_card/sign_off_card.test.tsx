import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { DONE } from '../../fixtures/board_sections'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { SignOffTask } from '../board_data'
import { SignOffCard, type SignOffCardProps } from './sign_off_card'

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

describe('SignOffCard actions', () => {
  function renderActions(props: Partial<SignOffCardProps> = {}) {
    const handlers = {
      onSignOff: vi.fn(),
      onStartFollowUp: vi.fn(),
      onArchive: vi.fn(),
    }
    const rendered = renderComponent(
      <SignOffCard task={DONE.flaky} onOpenTask={() => {}} {...handlers} {...props} />
    )
    return { ...rendered, ...handlers }
  }

  test('the actions row has Sign off, Follow up and Archive, in that order', () => {
    renderActions()
    const buttons = screen.getAllByRole('button').map((button) => button.textContent)

    expect(buttons).toEqual([DONE.flaky.task.title, 'Sign off', 'Follow up', 'Archive'])
  })

  test('each button is drawn only when the task can take that action', () => {
    renderActions({
      task: { ...DONE.flaky, canAct: { signOff: false, followUp: true, archive: false } },
    })

    expect(screen.queryByRole('button', { name: 'Sign off' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Follow up' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  test('Sign off reports the task id at once', async () => {
    const { user, onSignOff } = renderActions()

    await user.click(screen.getByRole('button', { name: 'Sign off' }))

    expect(onSignOff).toHaveBeenCalledExactlyOnceWith(DONE.flaky.task.id)
  })

  test('Follow up asks for the composer on this card', async () => {
    const { user, onStartFollowUp } = renderActions()

    await user.click(screen.getByRole('button', { name: 'Follow up' }))

    expect(onStartFollowUp).toHaveBeenCalledExactlyOnceWith(DONE.flaky.task.id)
  })

  test('Archive asks first, focusing Keep task, and reports only after the confirmation', async () => {
    const { user, onArchive } = renderActions()

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onArchive).not.toHaveBeenCalled()
    const group = screen.getByRole('group', {
      name: `Archive “${DONE.flaky.task.title}”? It leaves every list.`,
    })
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: 'Keep task' }))
    expect(screen.queryByRole('button', { name: 'Sign off' })).toBeNull()

    await user.click(within(group).getByRole('button', { name: 'Archive' }))
    expect(onArchive).toHaveBeenCalledExactlyOnceWith(DONE.flaky.task.id)
  })

  test('Keep task reports nothing, brings the actions back and returns focus to Archive', async () => {
    const { user, onArchive } = renderActions()

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await user.click(screen.getByRole('button', { name: 'Keep task' }))

    expect(onArchive).not.toHaveBeenCalled()
    expect(screen.queryByRole('group')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Archive' }))
  })

  test('Escape in the question dismisses it too', async () => {
    const { user, onArchive } = renderActions()

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await user.keyboard('{Escape}')

    expect(onArchive).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Archive' }))
  })

  test('while Sign off is in flight it is busy and the other buttons are disabled', async () => {
    const { user, onSignOff, onStartFollowUp } = renderActions({ pending: 'signOff' })
    const signOff = screen.getByRole('button', { name: 'Sign off' })

    expect(signOff.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Follow up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()

    await user.click(signOff)
    expect(onSignOff).not.toHaveBeenCalled()
    expect(onStartFollowUp).not.toHaveBeenCalled()
  })

  test('while an archive is in flight its confirm button is busy and Keep task disabled', async () => {
    const { user, rerender, onArchive } = renderActions()

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await user.click(screen.getAllByRole('button', { name: 'Archive' }).at(-1)!)
    rerender(
      <SignOffCard
        task={DONE.flaky}
        onOpenTask={() => {}}
        onArchive={onArchive}
        pending="archive"
      />
    )

    const group = screen.getByRole('group')
    expect(within(group).getByRole('button', { name: 'Archive' }).getAttribute('aria-busy')).toBe(
      'true'
    )
    expect(within(group).getByRole('button', { name: 'Keep task' })).toBeDisabled()
  })

  test('a composer replaces the actions row', () => {
    renderActions({ composer: <p>The composer</p> })

    expect(screen.getByText('The composer')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sign off' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Follow up' })).toBeNull()
  })
})
