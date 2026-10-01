// Copied from anachoic inertia/components/patterns/empty_state/empty_state.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { EmptyState } from './empty_state'

function boxOf(message: string): HTMLElement {
  return screen.getByText(message).parentElement as HTMLElement
}

describe('EmptyState', () => {
  test('dashed: a dashed neutral-400 box, --space-6 padding, heading type at 12px', () => {
    renderComponent(<EmptyState variant="dashed" message="Nothing waiting on you" />)
    const text = getComputedStyle(screen.getByText('Nothing waiting on you'))
    const box = getComputedStyle(boxOf('Nothing waiting on you'))

    expect(box.borderTopStyle).toBe('dashed')
    expect(box.borderTopWidth).toBe('1px')
    expect(box.borderTopColor).toBe(resolvedColor('--color-neutral-400'))
    expect(box.paddingTop).toBe('20.4px')
    expect(box.textAlign).toBe('center')
    expect(text.fontWeight).toBe('400')
    expect(text.fontSize).toBe('12px')
    expect(Number.parseFloat(text.letterSpacing)).toBeCloseTo(12 * 0.14)
    expect(text.textTransform).toBe('uppercase')
    expect(text.color).toBe(resolvedColor('--color-text-subtle'))
  })

  test('framed: a solid divider box, --space-8 padding, text-name', () => {
    renderComponent(<EmptyState variant="framed" message="Nothing completed yet" />)
    const text = screen.getByText('Nothing completed yet')
    const box = getComputedStyle(boxOf('Nothing completed yet'))

    expect(box.borderTopStyle).toBe('solid')
    expect(box.borderTopColor).toBe(resolvedColor('--color-divider'))
    expect(box.paddingTop).toBe('27.2px')
    expect(text.classList.contains('text-name')).toBe(true)
    expect(getComputedStyle(text).color).toBe(resolvedColor('--color-text-subtle'))
  })

  test('the message is shown as given; the uppercase comes from CSS', () => {
    renderComponent(<EmptyState variant="framed" message="No chain yet · describe it in chat" />)

    expect(screen.getByText('No chain yet · describe it in chat').textContent).toBe(
      'No chain yet · describe it in chat'
    )
  })
})
