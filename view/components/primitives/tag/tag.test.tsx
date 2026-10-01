// Copied from anachoic inertia/components/primitives/tag/tag.test.tsx at fd99e0d
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { Tag, TAG_TYPES, TAG_VARIANTS, type TagType, type TagVariant } from './tag'

function renderTag(variant: TagVariant, type?: TagType, text = 'New feature') {
  const result = renderComponent(
    <Tag variant={variant} type={type}>
      {text}
    </Tag>
  )
  return { ...result, tag: result.getByText(text) }
}

const FILLS: Record<TagVariant, { background: string; color: string; border?: string }> = {
  outline: { background: 'transparent', color: '--color-text-accent', border: '--color-accent' },
  accent: { background: '--color-accent-100', color: '--color-accent-800' },
  neutral: { background: '--color-neutral-100', color: '--color-neutral-800' },
}

function colorOf(value: string) {
  return value === 'transparent' ? 'rgba(0, 0, 0, 0)' : resolvedColor(value)
}

describe('Tag', () => {
  test.each(TAG_VARIANTS)('%s has its fill, text and border colors', (variant) => {
    const { tag } = renderTag(variant)
    const style = getComputedStyle(tag)
    const expected = FILLS[variant]

    expect(style.backgroundColor).toBe(colorOf(expected.background))
    expect(style.color).toBe(resolvedColor(expected.color))
    if (expected.border) {
      expect(style.borderTopStyle).toBe('solid')
      expect(style.borderTopWidth).toBe('1px')
      expect(style.borderTopColor).toBe(resolvedColor(expected.border))
    } else {
      expect(style.borderTopStyle).toBe('none')
    }
  })

  test('the outline text is --color-text-accent, not the raw accent', () => {
    const { tag } = renderTag('outline')

    expect(getComputedStyle(tag).color).not.toBe(resolvedColor('--color-accent'))
  })

  test.each(TAG_VARIANTS.flatMap((variant) => TAG_TYPES.map((type) => ({ variant, type }))))(
    '$variant $type is square with 3px by 10px padding',
    ({ variant, type }) => {
      const style = getComputedStyle(renderTag(variant, type).tag)

      expect(style.padding).toBe('3px 10px')
      expect(style.borderRadius).toBe('0px')
    }
  )

  test('a label is heading type: 10px, 0.08em, in capitals', () => {
    const style = getComputedStyle(renderTag('outline').tag)

    expect(style.fontFamily).toContain('Barlow Condensed')
    expect(style.fontWeight).toBe('400')
    expect(style.fontSize).toBe('10px')
    expect(style.letterSpacing).toBe(`${10 * 0.08}px`)
    expect(style.textTransform).toBe('uppercase')
  })

  test('a count is body type: 11px, 0.02em, as written', () => {
    const style = getComputedStyle(renderTag('accent', 'count', '3 files').tag)

    expect(style.fontFamily).toMatch(/^"?Barlow"?,/)
    expect(style.fontWeight).toBe('400')
    expect(style.fontSize).toBe('11px')
    expect(style.letterSpacing).toBe(`${11 * 0.02}px`)
    expect(style.textTransform).toBe('none')
  })

  test('a long single-word name breaks inside a narrow column', () => {
    const name = 'Internationalisationandlocalisationsweep'
    const { getByText } = renderComponent(
      <div style={{ width: 120 }}>
        <Tag variant="outline">{name}</Tag>
      </div>
    )

    expect(getByText(name).getBoundingClientRect().width).toBeLessThanOrEqual(120)
  })
})
