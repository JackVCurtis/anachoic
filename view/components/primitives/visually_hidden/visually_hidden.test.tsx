// Copied from anachoic inertia/components/primitives/visually_hidden/visually_hidden.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { isInaccessible } from '@testing-library/dom'
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { VisuallyHidden } from './visually_hidden'

describe('VisuallyHidden', () => {
  test('its text is in the accessibility tree and has no visible box', () => {
    renderComponent(
      <button type="button">
        <span aria-hidden="true">×</span>
        <VisuallyHidden>Close the drawer</VisuallyHidden>
      </button>
    )
    const text = screen.getByText('Close the drawer')
    const style = getComputedStyle(text)
    const box = text.getBoundingClientRect()

    expect(screen.getByRole('button', { name: 'Close the drawer' })).toBeTruthy()
    expect(isInaccessible(text)).toBe(false)
    expect(style.display).not.toBe('none')
    expect(style.visibility).toBe('visible')
    expect(style.position).toBe('absolute')
    expect(style.clipPath).toBe('inset(50%)')
    expect(style.overflow).toBe('hidden')
    expect(box.width).toBeLessThanOrEqual(1)
    expect(box.height).toBeLessThanOrEqual(1)
  })

  test('as an h1 it is the level 1 heading and has no visible box', () => {
    renderComponent(<VisuallyHidden element="h1">Board</VisuallyHidden>)
    const heading = screen.getByRole('heading', { level: 1, name: 'Board' })
    const box = heading.getBoundingClientRect()

    expect(heading.tagName).toBe('H1')
    expect(getComputedStyle(heading).position).toBe('absolute')
    expect(box.width).toBeLessThanOrEqual(1)
    expect(box.height).toBeLessThanOrEqual(1)
  })
})
