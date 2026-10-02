// Copied from anachoic inertia/components/patterns/busy_indicator/busy_indicator.test.tsx at fd99e0d
/// <reference types="@vitest/browser-playwright" />

import { screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { cdp } from 'vitest/browser'
import { busy } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { BusyIndicator } from './busy_indicator'

async function emulateReducedMotion(reduce: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  })
}

function renderIndicator(label: string = busy.loadingTask) {
  const result = renderComponent(<BusyIndicator label={label} />)
  const status = screen.getByRole('status')
  const square = status.firstElementChild as HTMLElement
  const text = status.lastElementChild as HTMLElement
  return { ...result, status, square, text }
}

afterEach(async () => {
  await emulateReducedMotion(false)
})

describe('BusyIndicator', () => {
  test.each([busy.loadingTask, busy.loadingBoard])(
    'is a polite status region that reads "%s"',
    (label) => {
      const { status } = renderIndicator(label)

      expect(status).toHaveTextContent(label)
      expect(status.getAttribute('aria-live')).toBe('polite')
    }
  )

  test('is announced when it appears', async () => {
    const { rerender } = renderComponent(<div />)
    expect(screen.queryByRole('status')).toBeNull()

    rerender(<BusyIndicator label={busy.loadingBoard} />)

    expect(screen.getByRole('status')).toHaveTextContent(busy.loadingBoard)
  })

  test('shows the busy square, then the label, with --space-2 between them', () => {
    const { status, square, text } = renderIndicator()

    expect(square.getAttribute('aria-hidden')).toBe('true')
    expect(getComputedStyle(square).backgroundColor).toBe(resolvedColor('--color-accent', square))
    expect(text.textContent).toBe(busy.loadingTask)
    expect(getComputedStyle(status).columnGap).toBe(
      getComputedStyle(document.documentElement).getPropertyValue('--space-2').trim()
    )
    expect(text.getBoundingClientRect().left).toBeGreaterThan(square.getBoundingClientRect().right)
  })

  test('the label is text-label in --color-text-subtle', () => {
    const { text } = renderIndicator()
    const style = getComputedStyle(text)

    expect(text.classList.contains('text-label')).toBe(true)
    expect(style.fontSize).toBe('10px')
    expect(style.textTransform).toBe('uppercase')
    expect(style.color).toBe(resolvedColor('--color-text-subtle', text))
  })

  test('the square blinks once a second', () => {
    const { square } = renderIndicator()
    const animations = square.getAnimations()

    expect(getComputedStyle(square).animationName).toBe('blink')
    expect(getComputedStyle(square).animationDuration).toBe('1s')
    expect(animations).toHaveLength(1)
    expect(animations[0].playState).toBe('running')
  })

  test('the square is still and solid under reduced motion', async () => {
    await emulateReducedMotion(true)
    const { square } = renderIndicator()

    expect(square.getAnimations()).toHaveLength(0)
    expect(getComputedStyle(square).opacity).toBe('1')
  })

  test('a blinking square stops when reduced motion is asked for', async () => {
    const { square } = renderIndicator()
    expect(square.getAnimations()).toHaveLength(1)

    await emulateReducedMotion(true)

    expect(square.getAnimations()).toHaveLength(0)
    expect(getComputedStyle(square).opacity).toBe('1')
  })
})
