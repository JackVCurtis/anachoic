// Copied from anachoic inertia/components/primitives/icon_button/icon_button.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { IconButton } from './icon_button'

describe('IconButton', () => {
  test('its name reaches assistive technology from aria-label, and the glyph is hidden', () => {
    renderComponent(<IconButton glyph="×" aria-label="Close" />)
    const button = screen.getByRole('button', { name: 'Close' })
    const glyph = button.firstElementChild as HTMLElement

    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    expect(glyph.textContent).toBe('×')
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
  })

  test('an aria-label is required by the compiler', () => {
    // @ts-expect-error The button has no name without aria-label.
    const nameless = <IconButton glyph="×" />
    // @ts-expect-error The name comes from aria-label only.
    const labelledBy = <IconButton glyph="×" aria-labelledby="title" />

    expect([nameless, labelledBy]).toHaveLength(2)
  })

  test('a press raises onPress, by click, Enter or Space', async () => {
    const onPress = vi.fn()
    const { user } = renderComponent(<IconButton glyph="×" aria-label="Close" onPress={onPress} />)

    await user.click(screen.getByRole('button'))
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onPress).toHaveBeenCalledTimes(3)
  })

  test('a disabled button does not raise onPress', async () => {
    const onPress = vi.fn()
    const { user } = renderComponent(
      <IconButton glyph="×" aria-label="Close" disabled onPress={onPress} />
    )
    const button = screen.getByRole('button')

    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    expect(onPress).not.toHaveBeenCalled()
    expect(getComputedStyle(button).opacity).toBe('0.45')
  })

  test('is 36px square with no padding, the glyph centered at 16px', () => {
    renderComponent(<IconButton glyph="×" aria-label="Close" />)
    const button = screen.getByRole('button')
    const glyph = button.firstElementChild as HTMLElement
    const box = button.getBoundingClientRect()
    const glyphBox = glyph.getBoundingClientRect()
    const style = getComputedStyle(button)

    expect(box.width).toBe(36)
    expect(box.height).toBe(36)
    expect(style.padding).toBe('0px')
    expect(getComputedStyle(glyph).fontSize).toBe('16px')
    expect(glyphBox.left + glyphBox.width / 2).toBeCloseTo(box.left + box.width / 2, 0)
    expect(glyphBox.top + glyphBox.height / 2).toBeCloseTo(box.top + box.height / 2, 0)
  })

  test('has the secondary look, with its hover fill and keyboard focus ring', async () => {
    renderComponent(<IconButton glyph="×" aria-label="Close" />)
    const button = screen.getByRole('button')

    expect(getComputedStyle(button).borderTopColor).toBe(resolvedColor('--color-divider'))
    expect(getComputedStyle(button).color).toBe(resolvedColor('--color-text'))
    expect(getComputedStyle(button).borderRadius).toBe('0px')

    await userEvent.hover(button)
    expect(getComputedStyle(button).backgroundColor).toBe(resolvedColor('--tint-hover'))
    await userEvent.unhover(button)

    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(button)
    expect(getComputedStyle(button).outlineWidth).toBe('2px')
    expect(getComputedStyle(button).outlineOffset).toBe('2px')
    expect(getComputedStyle(button).outlineColor).toBe(resolvedColor('--tone-focus'))
  })
})
