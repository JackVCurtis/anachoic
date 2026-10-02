// Copied from anachoic inertia/components/board/agent_slot_card/agent_slot_card.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SESSIONS } from '../../fixtures/board_sections'
import { renderComponent } from '../../testing/render'
import type { BoardSession } from '../board_data'
import { SessionCard } from './session_card'

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
})
