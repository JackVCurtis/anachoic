// Copied from anachoic inertia/components/primitives/icon/icon.test.tsx at fd99e0d
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { Icon, ICON_NAMES, ICON_SIZES } from './icon'

describe('Icon', () => {
  test.each(ICON_NAMES)('%s is drawn at stroke-width 1.5 and hidden', (name) => {
    const { container } = renderComponent(<Icon name={name} size={14} />)
    const svg = container.querySelector('svg') as SVGSVGElement

    expect(svg.getAttribute('stroke-width')).toBe('1.5')
    expect(getComputedStyle(svg).strokeWidth).toBe('1.5px')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
  })

  test.each(ICON_SIZES)('is drawn %ipx square', (size) => {
    const { container } = renderComponent(<Icon name="workflow" size={size} />)
    const box = (container.querySelector('svg') as SVGSVGElement).getBoundingClientRect()

    expect(box.width).toBe(size)
    expect(box.height).toBe(size)
  })

  test('takes the color of the text around it', () => {
    const { container } = renderComponent(
      <span style={{ color: 'rgb(1, 2, 3)' }}>
        <Icon name="lock" size={12} />
        Read-only
      </span>
    )

    expect(getComputedStyle(container.querySelector('svg') as SVGSVGElement).color).toBe(
      'rgb(1, 2, 3)'
    )
  })

  test('the closed set of names is checked by the compiler', () => {
    // @ts-expect-error `check` is not in the set of icons.
    const outside = <Icon name="check" size={14} />
    // @ts-expect-error 16 is not a documented size.
    const tooBig = <Icon name="plus" size={16} />

    expect([outside, tooBig]).toHaveLength(2)
  })
})
