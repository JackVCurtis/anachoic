// Copied from anachoic inertia/components/primitives/frame/frame.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { Frame, type FrameEmphasis, type FrameLine } from './frame'

function frameOf(text: string): HTMLElement {
  return screen.getByText(text).parentElement as HTMLElement
}

const BORDERS: Array<{ line: FrameLine; emphasis: FrameEmphasis; token: string }> = [
  { line: 'solid', emphasis: 'default', token: '--tone-border' },
  { line: 'solid', emphasis: 'muted', token: '--color-neutral-300' },
  { line: 'solid', emphasis: 'selected', token: '--color-accent-300' },
  { line: 'dashed', emphasis: 'default', token: '--color-neutral-400' },
  { line: 'dashed', emphasis: 'selected', token: '--color-accent-300' },
]

describe('Frame', () => {
  test('an inverse frame sets the tone scope, and a child reads the inverted --tone-fg', () => {
    renderComponent(
      <Frame tone="inverse">
        <p>Approve the plan</p>
      </Frame>
    )
    const child = screen.getByText('Approve the plan')
    const frame = child.parentElement as HTMLElement
    const style = getComputedStyle(frame)

    expect(frame.dataset.tone).toBe('inverse')
    expect(resolvedColor('--tone-fg', child)).toBe(resolvedColor('--inverse-fg'))
    expect(resolvedColor('--tone-fg', child)).not.toBe(resolvedColor('--tone-fg'))
    expect(getComputedStyle(child).color).toBe(resolvedColor('--inverse-fg'))
    expect(style.backgroundColor).toBe(resolvedColor('--inverse-bg'))
    expect(style.borderTopColor).toBe(resolvedColor('--inverse-bg'))
  })

  test('a light frame writes no tone and is transparent', () => {
    renderComponent(
      <Frame>
        <p>Plain</p>
      </Frame>
    )
    const frame = frameOf('Plain')

    expect(frame.hasAttribute('data-tone')).toBe(false)
    expect(getComputedStyle(frame).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  test.each(BORDERS)('$line $emphasis border is $token', ({ line, emphasis, token }) => {
    renderComponent(
      <Frame line={line} emphasis={emphasis}>
        <p>Bordered</p>
      </Frame>
    )
    const style = getComputedStyle(frameOf('Bordered'))

    expect(style.borderTopStyle).toBe(line)
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderTopColor).toBe(resolvedColor(token))
  })

  test('the box is square, unshadowed and has no padding of its own', () => {
    renderComponent(
      <Frame>
        <p>Square</p>
      </Frame>
    )
    const style = getComputedStyle(frameOf('Square'))

    expect(style.borderRadius).toBe('0px')
    expect(style.boxShadow).toBe('none')
    expect(style.padding).toBe('0px')
  })

  test('the tint fill is --color-accent-100', () => {
    renderComponent(
      <Frame fill="tint">
        <p>Tinted</p>
      </Frame>
    )

    expect(getComputedStyle(frameOf('Tinted')).backgroundColor).toBe(
      resolvedColor('--color-accent-100')
    )
  })

  test('the hatch fill is a 135 degree gradient of 6px clear and 1px --tint-hatch', () => {
    renderComponent(
      <Frame fill="hatch">
        <p>Hatched</p>
      </Frame>
    )
    const image = getComputedStyle(frameOf('Hatched')).backgroundImage

    expect(image).toBe(
      `repeating-linear-gradient(135deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 6px, ${resolvedColor('--tint-hatch')} 6px, ${resolvedColor('--tint-hatch')} 7px)`
    )
  })

  test.each(['div', 'article', 'section', 'li'] as const)('renders a %s when asked', (element) => {
    const content = <p>Element</p>
    renderComponent(
      element === 'li' ? (
        <ul>
          <Frame element="li">{content}</Frame>
        </ul>
      ) : (
        <Frame element={element}>{content}</Frame>
      )
    )

    expect(frameOf('Element').tagName).toBe(element.toUpperCase())
  })

  test('a className is added beside the frame classes', () => {
    renderComponent(
      <Frame className="placed" emphasis="selected">
        <p>Placed</p>
      </Frame>
    )
    const frame = frameOf('Placed')

    expect(frame.classList.contains('placed')).toBe(true)
    expect(frame.classList.length).toBe(3)
  })
})
