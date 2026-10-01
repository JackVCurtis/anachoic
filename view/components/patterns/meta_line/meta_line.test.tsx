// Copied from anachoic inertia/components/patterns/meta_line/meta_line.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { LONG_TEXT } from '../../fixtures/long_text'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { META_LINE_TONES, MetaLine, type MetaLineTone } from './meta_line'

/**
 * The text a screen reader meets, in document order: every text node that
 * has no aria-hidden ancestor inside the line.
 */
function spokenText(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const spoken: string[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('[aria-hidden="true"]')) {
      spoken.push(node.textContent ?? '')
    }
  }
  return spoken
}

function lineOf(firstFact: string): HTMLElement {
  return screen.getByText(firstFact).parentElement as HTMLElement
}

const TYPE: Record<MetaLineTone, { className: string; size: string; color: string }> = {
  meta: { className: 'text-hint', size: '11px', color: '--color-text-meta' },
  detail: { className: 'text-detail', size: '12px', color: '--color-text-muted' },
}

describe('MetaLine', () => {
  test.each(META_LINE_TONES)('%s has its type and color', (tone) => {
    renderComponent(<MetaLine tone={tone} facts={['3 steps', '1 for you']} />)
    const line = lineOf('3 steps')
    const style = getComputedStyle(line)

    expect(line.classList.contains(TYPE[tone].className)).toBe(true)
    expect(style.fontSize).toBe(TYPE[tone].size)
    expect(style.color).toBe(resolvedColor(TYPE[tone].color))
  })

  test('the separators are hidden and the facts are read in order', () => {
    renderComponent(
      <MetaLine tone="meta" facts={['Step 2/3', 'This chat', '3 steps', '1 for you']} />
    )
    const line = lineOf('Step 2/3')
    const separators = line.querySelectorAll('[aria-hidden="true"]')

    expect(spokenText(line)).toEqual(['Step 2/3', 'This chat', '3 steps', '1 for you'])
    expect(separators).toHaveLength(3)
    for (const separator of separators) {
      expect(separator.textContent).toBe(' · ')
      expect(separator.textContent?.codePointAt(1)).toBe(0xb7)
    }
    expect(line.textContent).toBe('Step 2/3 · This chat · 3 steps · 1 for you')
  })

  test('a line of one fact has no separator', () => {
    renderComponent(<MetaLine tone="detail" facts={['No chain yet']} />)

    expect(lineOf('No chain yet').querySelector('[aria-hidden]')).toBeNull()
  })

  test('empty facts are left out', () => {
    renderComponent(<MetaLine tone="meta" facts={['Step 1/2', '', '2 steps']} />)

    expect(lineOf('Step 1/2').textContent).toBe('Step 1/2 · 2 steps')
  })

  test('a session name of 40 characters wraps inside a narrow column', () => {
    renderComponent(
      <div style={{ width: 120 }}>
        <MetaLine tone="meta" facts={[LONG_TEXT.name, '3 steps']} />
      </div>
    )

    expect(screen.getByText(LONG_TEXT.name).getBoundingClientRect().width).toBeLessThanOrEqual(120)
  })
})
