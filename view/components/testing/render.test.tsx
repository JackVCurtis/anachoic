// Copied from anachoic inertia/components/testing/render.test.tsx at fd99e0d
import { useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { FIXED_NOW } from '../fixtures/clock'
import { useNow } from '../hooks/use_now/use_now'
import { renderComponent, renderInTone } from './render'
import { resolvedColor } from './resolved_color'

function Clock() {
  return <time>{useNow('second')}</time>
}

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Pressed {count}
    </button>
  )
}

describe('renderComponent', () => {
  test('the component sees FIXED_NOW, or the instant given', () => {
    renderComponent(<Clock />)
    expect(screen.getByText(FIXED_NOW)).toBeTruthy()

    renderComponent(<Clock />, { now: '2026-01-05T08:00:00.000Z' })
    expect(screen.getByText('2026-01-05T08:00:00.000Z')).toBeTruthy()
  })

  test('the light tone adds no element around the component', () => {
    const { container } = renderComponent(<Counter />)

    expect(container.firstElementChild?.tagName).toBe('BUTTON')
    expect(container.querySelector('[data-tone]')).toBeNull()
  })

  test('returns a user-event instance that drives the component', async () => {
    const { user } = renderComponent(<Counter />)

    await user.click(screen.getByRole('button'))
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button').textContent).toBe('Pressed 1')
  })
})

describe('renderInTone', () => {
  test('the inverse tone paints the inverted field and reverses the text', () => {
    const { container } = renderInTone(<Counter />, 'inverse')
    const frame = container.firstElementChild as HTMLElement
    const style = getComputedStyle(frame)

    expect(frame.dataset.tone).toBe('inverse')
    expect(style.backgroundColor).toBe(resolvedColor('--inverse-bg'))
    expect(style.color).toBe(resolvedColor('--tone-fg', frame))
    expect(style.color).toBe(resolvedColor('--inverse-fg'))
    expect(frame.contains(screen.getByRole('button'))).toBe(true)
  })

  test('tone tokens inside the frame take their inverse values', () => {
    renderInTone(<Counter />, 'inverse')
    const button = screen.getByRole('button')

    expect(resolvedColor('--tone-focus', button)).toBe(resolvedColor('--color-accent-300'))
    expect(resolvedColor('--tone-focus')).toBe(resolvedColor('--color-accent'))
  })
})
