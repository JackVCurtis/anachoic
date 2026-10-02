// Copied from anachoic inertia/components/board/agent_slot_card/agent_slot_card.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SESSIONS } from '../../fixtures/board_sections'
import { fillTemplate, sessions as strings } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { BoardSession } from '../board_data'
import { SessionCard } from './session_card'

function renderRemovable(session: BoardSession, removing = false) {
  const onRemove = vi.fn()
  const rendered = renderComponent(
    <SessionCard session={session} onOpenTask={vi.fn()} onRemove={onRemove} removing={removing} />
  )
  return { ...rendered, onRemove }
}

function renderCard(session: BoardSession) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<SessionCard session={session} onOpenTask={onOpenTask} />)
  return { ...rendered, onOpenTask }
}

describe('SessionCard', () => {
  test('a session holding a running step reads "Running" and its step line', () => {
    renderCard(SESSIONS.running)

    expect(screen.getByText('api-server')).toBeVisible()
    expect(screen.getByText('Worker')).toBeVisible()
    expect(screen.getByText('Running')).toBeVisible()
    expect(screen.getByText('Step 1 · Draft the migration')).toBeVisible()
    expect(screen.queryByText(/elapsed$/)).toBeNull()
  })

  test('a session holding a waiting step reads "Waiting on you" and is not inverted', () => {
    const { container } = renderCard(SESSIONS.waitingWorker)

    expect(screen.getByText('Waiting on you')).toBeVisible()
    expect(container.querySelector('[data-tone="inverse"]')).toBeNull()
    expect(container.querySelector('article')).not.toBeNull()
  })

  test('a session holding a blocked step says what it is blocked on, with the attention square', () => {
    const { container } = renderCard(SESSIONS.blocked)

    expect(screen.getByText('api-server')).toBeVisible()
    expect(screen.getByText('Blocked on T-030 step 2')).toBeVisible()
    expect(screen.getByText('Step 2 · Deploy')).toBeVisible()
    expect(screen.queryByText('Waiting on you')).toBeNull()
    const square = container.querySelector('[aria-hidden="true"]')
    expect(square?.className).toMatch(/attention/)
    expect(container.querySelector('[data-tone="inverse"]')).toBeNull()
  })

  test('this chat is named "This chat" once, with no kind tag', () => {
    renderCard(SESSIONS.thisChat)

    expect(screen.getAllByText('This chat')).toHaveLength(1)
    expect(screen.queryByText('Worker')).toBeNull()
    expect(screen.getByText('Step 2 · Choose the cache key')).toBeVisible()
  })

  test('a session holding nothing reads "Idle" and has no main action', () => {
    const { container } = renderCard(SESSIONS.idle)

    expect(screen.getByText('web-client')).toBeVisible()
    expect(screen.getByText('Idle')).toBeVisible()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelector('article')).toBeNull()
  })

  test("an ended session lists each released task's id and has no main action", () => {
    renderCard(SESSIONS.endedTwo)

    expect(screen.getByText('Ended 4m ago')).toBeVisible()
    expect(screen.getByText('Released')).toBeVisible()
    for (const task of SESSIONS.endedTwo.released) {
      expect(screen.getByText(task.displayId)).toBeVisible()
      expect(screen.getByText(task.title)).toBeVisible()
    }
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  test('an ended session reads "Ended just now" in its first minute', () => {
    renderCard({ ...SESSIONS.endedTwo, endedAt: '2026-03-12T09:40:30.000Z' })

    expect(screen.getByText('Ended just now')).toBeVisible()
  })

  test("pressing a holding card's title raises onOpenTask with the task id", async () => {
    const { user, onOpenTask } = renderCard(SESSIONS.running)
    const holding = SESSIONS.running.holding!
    const title = screen.getByRole('button', { name: holding.task.title })

    expect(title.closest('h3')).not.toBeNull()
    await user.click(title)

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(holding.task.id)
  })

  test('no card offers Cancel step or shows a cap', () => {
    const all = [
      ...SESSIONS.busy,
      SESSIONS.blocked,
      ...SESSIONS.severalWorkers,
      ...SESSIONS.idleSessions,
      SESSIONS.endedTwo,
      ...SESSIONS.many,
      ...SESSIONS.long,
    ]
    for (const session of all) {
      const { container, unmount } = renderCard(session)
      expect(container.textContent).not.toMatch(/Cancel step|Capped|\bcap\b/i)
      unmount()
    }
  })

  describe('Remove', () => {
    test('appears on worker cards, live or ended, and not on this chat', () => {
      const workers = [
        SESSIONS.running,
        SESSIONS.waitingWorker,
        SESSIONS.blocked,
        SESSIONS.idle,
        SESSIONS.endedTwo,
      ]
      for (const session of workers) {
        const { unmount } = renderRemovable(session)
        expect(screen.getByRole('button', { name: strings.remove })).toBeVisible()
        unmount()
      }

      renderRemovable(SESSIONS.thisChat)
      expect(screen.queryByRole('button', { name: strings.remove })).toBeNull()
    })

    test('is not offered without onRemove', () => {
      renderCard(SESSIONS.running)

      expect(screen.queryByRole('button', { name: strings.remove })).toBeNull()
    })

    test('on a worker holding a step it asks first, and confirming removes it once', async () => {
      const { user, onRemove } = renderRemovable(SESSIONS.running)
      const holding = SESSIONS.running.holding!

      await user.click(screen.getByRole('button', { name: strings.remove }))

      expect(onRemove).not.toHaveBeenCalled()
      const question = fillTemplate(strings.removeQuestion, {
        name: SESSIONS.running.name,
        id: holding.task.displayId,
      })
      const group = screen.getByRole('group', { name: question })
      expect(within(group).getByRole('button', { name: strings.keepWorker })).toHaveFocus()

      await user.click(within(group).getByRole('button', { name: strings.remove }))

      expect(onRemove).toHaveBeenCalledExactlyOnceWith(SESSIONS.running.id)
    })

    test('the question names the worker and the task it holds', async () => {
      const { user } = renderRemovable(SESSIONS.running)

      await user.click(screen.getByRole('button', { name: strings.remove }))

      expect(
        screen.getByText(
          `Remove api-server? Its step on ${SESSIONS.running.holding!.task.displayId} goes back to the queue.`
        )
      ).toBeVisible()
    })

    test('a worker that blocked its step asks first too', async () => {
      const { user, onRemove } = renderRemovable(SESSIONS.blocked)

      await user.click(screen.getByRole('button', { name: strings.remove }))

      expect(onRemove).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: strings.keepWorker })).toBeVisible()
    })

    test('"Keep worker" closes the question, removes nothing and returns focus to Remove', async () => {
      const { user, onRemove } = renderRemovable(SESSIONS.running)

      await user.click(screen.getByRole('button', { name: strings.remove }))
      await user.click(screen.getByRole('button', { name: strings.keepWorker }))

      expect(screen.queryByRole('group')).toBeNull()
      expect(screen.getByRole('button', { name: strings.remove })).toHaveFocus()
      expect(onRemove).not.toHaveBeenCalled()
    })

    test.each([
      ['an idle worker', SESSIONS.idle],
      ['an ended worker', SESSIONS.endedTwo],
    ])('on %s it removes at once, without a question', async (_, session) => {
      const { user, onRemove } = renderRemovable(session)

      await user.click(screen.getByRole('button', { name: strings.remove }))

      expect(screen.queryByRole('group')).toBeNull()
      expect(onRemove).toHaveBeenCalledExactlyOnceWith(session.id)
    })

    test('while the removal is in flight the confirm button is busy', async () => {
      const { user, rerender } = renderRemovable(SESSIONS.running)

      await user.click(screen.getByRole('button', { name: strings.remove }))
      rerender(
        <SessionCard session={SESSIONS.running} onOpenTask={vi.fn()} onRemove={vi.fn()} removing />
      )

      const group = screen.getByRole('group')
      expect(within(group).getByRole('button', { name: strings.remove })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      expect(within(group).getByRole('button', { name: strings.keepWorker })).toBeDisabled()
    })
  })
})
