// Copied from anachoic inertia/components/board/agents_section/agents_section.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SESSIONS } from '../../fixtures/board_sections'
import { sessions as strings } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { BoardSession } from '../board_data'
import { IdleSection } from './idle_section'

function renderSection(sessions: readonly BoardSession[]) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<IdleSection sessions={sessions} onOpenTask={onOpenTask} />)
  const section = screen
    .getByRole('heading', { level: 2, name: strings.idleTitle })
    .closest('section')!
  return { ...rendered, onOpenTask, section }
}

describe('IdleSection', () => {
  test('counts the idle sessions, leaves out those holding a step and shows the ended one after them', () => {
    const { section } = renderSection(SESSIONS.busy)
    const header = within(section).getByRole('heading', { level: 2 }).parentElement!

    expect(within(header).getByText('1')).toBeVisible()
    const states = [...section.querySelectorAll('li')]
      .filter((item) => item.parentElement?.closest('li') === null)
      .map((item) => item.querySelector('.text-status')?.textContent)
    expect(states).toEqual(['Idle', 'Ended 4m ago'])
  })

  test.each([
    ['no session', []],
    ['only sessions holding a step', [...SESSIONS.severalWorkers, SESSIONS.blocked]],
  ])('with %s it shows the empty state', (_, sessions) => {
    const { section } = renderSection(sessions)

    expect(within(section).getByText(strings.nothingIdle)).toBeVisible()
    expect(within(section).getByText('0')).toBeVisible()
  })

  test('twelve idle sessions fold after eight', async () => {
    const { user, section } = renderSection(SESSIONS.manyIdle)

    expect(within(section).getAllByText('Worker')).toHaveLength(8)
    await user.click(within(section).getByRole('button', { name: 'Show all 12' }))
    expect(within(section).getAllByText('Worker')).toHaveLength(12)
  })

  test('nothing reads Cancel step, Capped or a cap figure', () => {
    const { section } = renderSection([...SESSIONS.busy, SESSIONS.endedTwo])

    expect(section.textContent).not.toMatch(/Cancel step|Capped|\bcap\b/i)
  })

  test.each([
    ['an idle worker', SESSIONS.idle],
    ['an ended worker', SESSIONS.endedTwo],
  ])('when %s is removed, focus moves to the section heading', async (_, removed) => {
    const all = [SESSIONS.running, SESSIONS.idle, SESSIONS.endedTwo]
    const onRemoveSession = vi.fn()
    const section = (list: readonly BoardSession[]) => (
      <IdleSection sessions={list} onOpenTask={vi.fn()} onRemoveSession={onRemoveSession} />
    )
    const { user, rerender } = renderComponent(section(all))
    const card = screen.getByText(removed.name).closest('li')!

    await user.click(within(card).getByRole('button', { name: strings.remove }))
    expect(onRemoveSession).toHaveBeenCalledExactlyOnceWith(removed.id)
    rerender(section(all.filter((session) => session.id !== removed.id)))

    expect(screen.getByRole('heading', { level: 2, name: strings.idleTitle })).toHaveFocus()
  })

  test('the dedicated session offers no Remove', () => {
    renderComponent(
      <IdleSection
        sessions={SESSIONS.idleSessions}
        onOpenTask={vi.fn()}
        onRemoveSession={vi.fn()}
      />
    )

    expect(screen.getAllByRole('button', { name: strings.remove })).toHaveLength(
      SESSIONS.idleSessions.filter((session) => session.kind === 'worker').length
    )
  })
})
