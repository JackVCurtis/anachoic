// Copied from anachoic inertia/components/primitives/status_square/status_square.test.tsx at fd99e0d
/// <reference types="@vitest/browser-playwright" />

import { isInaccessible } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { cdp } from 'vitest/browser'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { STATUS_SQUARE_STATES, StatusSquare, type StatusSquareState } from './status_square'

async function emulateReducedMotion(reduce: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  })
}

function renderSquare(state: StatusSquareState, tone: 'light' | 'inverse' = 'light') {
  const result = renderComponent(
    <div data-testid="row" style={{ display: 'flex', width: 40 }}>
      <StatusSquare state={state} />
      <span style={{ flex: 'none', width: 200 }}>{state}</span>
    </div>,
    { tone }
  )
  const square = result.getByTestId('row').firstElementChild as HTMLElement
  return { ...result, square }
}

const COLORS: Record<StatusSquareState, string> = {
  attention: '--tone-fg',
  busy: '--color-accent',
  running: '--color-accent',
  waiting: '--color-accent-900',
  idle: '--color-neutral-400',
}

const BLINKING = [
  { state: 'attention', period: '1.6s' },
  { state: 'busy', period: '1s' },
] as const

afterEach(async () => {
  await emulateReducedMotion(false)
})

describe('StatusSquare', () => {
  test.each(STATUS_SQUARE_STATES)(
    '%s is a 7px square that does not shrink in a crowded flex row',
    (state) => {
      const { square } = renderSquare(state)
      const box = square.getBoundingClientRect()

      expect(box.width).toBe(7)
      expect(box.height).toBe(7)
    }
  )

  test.each(STATUS_SQUARE_STATES)('%s takes its color on light and inverted fields', (state) => {
    for (const tone of ['light', 'inverse'] as const) {
      const { square, unmount } = renderSquare(state, tone)

      expect(getComputedStyle(square).backgroundColor).toBe(resolvedColor(COLORS[state], square))
      unmount()
    }
  })

  test('attention takes the ground color on the inverted field', () => {
    const { square } = renderSquare('attention', 'inverse')

    expect(getComputedStyle(square).backgroundColor).toBe(resolvedColor('--inverse-fg'))
  })

  test.each(STATUS_SQUARE_STATES)('%s is hidden from the accessibility tree', (state) => {
    const { square } = renderSquare(state)

    expect(square.getAttribute('aria-hidden')).toBe('true')
    expect(isInaccessible(square)).toBe(true)
  })

  test.each(BLINKING)('$state blinks forever, once every $period', ({ state, period }) => {
    const { square } = renderSquare(state)
    const style = getComputedStyle(square)
    const animations = square.getAnimations()

    expect(style.animationName).toBe('blink')
    expect(style.animationDuration).toBe(period)
    expect(style.animationIterationCount).toBe('infinite')
    expect(animations).toHaveLength(1)
    expect(animations[0].playState).toBe('running')
  })

  test.each(['running', 'waiting', 'idle'] as const)('%s is still', (state) => {
    const { square } = renderSquare(state)

    expect(getComputedStyle(square).animationName).toBe('none')
    expect(square.getAnimations()).toHaveLength(0)
  })

  test.each(BLINKING)(
    'with reduced motion $state has no running animation and is solid',
    async ({ state }) => {
      await emulateReducedMotion(true)
      const { square } = renderSquare(state)
      const style = getComputedStyle(square)

      expect(style.animationDuration).toBe('0s')
      expect(square.getAnimations()).toHaveLength(0)
      expect(style.opacity).toBe('1')
    }
  )

  test('a square already blinking stops when reduced motion is asked for', async () => {
    const { square } = renderSquare('attention')
    expect(square.getAnimations()).toHaveLength(1)

    await emulateReducedMotion(true)

    expect(square.getAnimations()).toHaveLength(0)
    expect(getComputedStyle(square).opacity).toBe('1')
  })
})
