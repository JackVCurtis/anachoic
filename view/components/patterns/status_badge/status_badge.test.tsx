// Copied from anachoic inertia/components/patterns/status_badge/status_badge.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { AGENT_ASKS } from '../../fixtures/pip_steps'
import { badgeFor, type TaskList } from '../../helpers/task_view'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { StatusBadge } from './status_badge'

const ACCENT = { background: '--color-accent-100', color: '--color-accent-800' }
const NEUTRAL = { background: '--color-neutral-100', color: '--color-neutral-800' }

const BADGES: ReadonlyArray<{ list: TaskList; label: string; look: typeof ACCENT }> = [
  { list: 'working', label: 'running', look: ACCENT },
  { list: 'yourTurn', label: 'your turn', look: ACCENT },
  { list: 'toSignOff', label: 'to sign off', look: ACCENT },
  { list: 'signedOff', label: 'done', look: ACCENT },
  { list: 'queue', label: 'queue', look: NEUTRAL },
  { list: 'backlog', label: 'backlog', look: NEUTRAL },
]

describe('StatusBadge', () => {
  test.each(BADGES)('$list reads "$label" in its look', ({ list, label, look }) => {
    expect(badgeFor(list).label).toBe(label)
    expect(badgeFor(list).look).toBe(look === ACCENT ? 'accent' : 'neutral')

    renderComponent(<StatusBadge list={list} />)
    const style = getComputedStyle(screen.getByText(label))

    expect(style.backgroundColor).toBe(resolvedColor(look.background))
    expect(style.color).toBe(resolvedColor(look.color))
  })

  test('is heading 400, 10px, 0.10em, in capitals, with 3px by 10px padding', () => {
    renderComponent(<StatusBadge list="queue" />)
    const style = getComputedStyle(screen.getByText('queue'))

    expect(style.fontFamily).toContain('Barlow Condensed')
    expect(style.fontWeight).toBe('400')
    expect(style.fontSize).toBe('10px')
    expect(style.letterSpacing).toBe(`${10 * 0.1}px`)
    expect(style.textTransform).toBe('uppercase')
    expect(style.padding).toBe('3px 10px')
  })

  test('a task in Your turn whose step a session still holds shows "your turn"', () => {
    const current = AGENT_ASKS.find((step) => step.status === 'waiting')

    expect(current?.owner).toBe('agent')
    expect(current?.sessionName).not.toBeNull()

    renderComponent(<StatusBadge list="yourTurn" />)

    expect(screen.getByText('your turn')).toBeTruthy()
    expect(screen.queryByText('running')).toBeNull()
  })
})
