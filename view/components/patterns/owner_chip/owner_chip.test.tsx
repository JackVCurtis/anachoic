// Copied from anachoic inertia/components/patterns/owner_chip/owner_chip.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { taskEntry } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { Owner, Tone } from '../../types'
import { OWNER_CHIP_SIZES, OwnerChip } from './owner_chip'

const COLORS: Record<Tone, Record<Owner, { border: string; color: string }>> = {
  light: {
    agent: { border: '--color-accent-700', color: '--color-accent-700' },
    you: { border: '--color-neutral-500', color: '--color-neutral-700' },
  },
  inverse: {
    agent: { border: '--inverse-chip-border', color: '--inverse-fg' },
    you: { border: '--inverse-chip-border', color: '--inverse-fg' },
  },
}

const CASES = (['light', 'inverse'] as const).flatMap((tone) =>
  (['agent', 'you'] as const).map((owner) => ({ tone, owner }))
)

describe('OwnerChip', () => {
  test.each(CASES)('$owner on $tone has its border and text colors', ({ tone, owner }) => {
    renderComponent(<OwnerChip owner={owner} size="sm" />, { tone })
    const style = getComputedStyle(
      screen.getByText(owner === 'agent' ? taskEntry.agentChip : taskEntry.youChip)
    )

    expect(style.borderTopStyle).toBe('solid')
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderTopColor).toBe(resolvedColor(COLORS[tone][owner].border))
    expect(style.color).toBe(resolvedColor(COLORS[tone][owner].color))
  })

  test('sm is text-note with 0 by 6px padding', () => {
    renderComponent(<OwnerChip owner="agent" size="sm" />)
    const chip = screen.getByText('agent')
    const style = getComputedStyle(chip)

    expect(chip.classList.contains('text-note')).toBe(true)
    expect(style.fontSize).toBe('10px')
    expect(style.letterSpacing).toBe(`${10 * 0.1}px`)
    expect(style.textTransform).toBe('uppercase')
    expect(style.padding).toBe('0px 6px')
  })

  test('md is heading 400, 11px, 0.12em, in capitals, with 1px by 7px padding', () => {
    renderComponent(<OwnerChip owner="you" size="md" />)
    const style = getComputedStyle(screen.getByText('you'))

    expect(style.fontFamily).toContain('Barlow Condensed')
    expect(style.fontWeight).toBe('400')
    expect(style.fontSize).toBe('11px')
    expect(style.letterSpacing).toBe('1.32px')
    expect(style.textTransform).toBe('uppercase')
    expect(style.padding).toBe('1px 7px')
  })

  test.each([
    { owner: 'agent', form: 'generic', sessionName: 'api-server', expected: 'agent' },
    { owner: 'agent', form: 'named', sessionName: 'api-server', expected: 'api-server' },
    { owner: 'agent', form: 'named', sessionName: 'This chat', expected: 'This chat' },
    { owner: 'agent', form: 'named', sessionName: null, expected: 'agent' },
    { owner: 'you', form: 'named', sessionName: 'api-server', expected: 'you' },
    { owner: 'you', form: 'generic', sessionName: undefined, expected: 'you' },
  ] as const)(
    '$owner, $form, $sessionName reads "$expected"',
    ({ owner, form, sessionName, expected }) => {
      renderComponent(<OwnerChip owner={owner} size="md" form={form} sessionName={sessionName} />)

      expect(screen.getByText(expected)).toBeTruthy()
    }
  )

  test.each(OWNER_CHIP_SIZES)('%s never wraps', (size) => {
    renderComponent(
      <div style={{ width: 10 }}>
        <OwnerChip owner="agent" size={size} form="named" sessionName="api-server" />
      </div>
    )
    const chip = screen.getByText('api-server')

    const oneLine = Number.parseFloat(getComputedStyle(chip).lineHeight) || 20

    expect(getComputedStyle(chip).whiteSpace).toBe('nowrap')
    expect(chip.getBoundingClientRect().width).toBeGreaterThan(10)
    expect(chip.getBoundingClientRect().height).toBeLessThan(oneLine * 2)
  })
})
