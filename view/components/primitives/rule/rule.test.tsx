// Copied from anachoic inertia/components/primitives/rule/rule.test.tsx at fd99e0d
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { Rule } from './rule'

function Row({ accent }: { accent?: boolean }) {
  return (
    <div data-testid="row" style={{ display: 'flex', width: 400, gap: 12 }}>
      <span style={{ width: 100 }}>Label</span>
      <Rule accent={accent} />
    </div>
  )
}

describe('Rule', () => {
  test('is a hidden 1px hairline in --tone-rule that fills the rest of its row', () => {
    const { getByTestId } = renderComponent(<Row />)
    const rule = getByTestId('row').lastElementChild as HTMLElement
    const box = rule.getBoundingClientRect()

    expect(rule.getAttribute('aria-hidden')).toBe('true')
    expect(box.height).toBe(1)
    expect(box.width).toBe(288)
    expect(getComputedStyle(rule).backgroundColor).toBe(resolvedColor('--tone-rule'))
  })

  test('the accent rule is --color-accent-300', () => {
    const { getByTestId } = renderComponent(<Row accent />)
    const rule = getByTestId('row').lastElementChild as HTMLElement

    expect(getComputedStyle(rule).backgroundColor).toBe(resolvedColor('--color-accent-300'))
  })

  test('on the inverted field it takes the inverted rule color', () => {
    const { getByTestId } = renderComponent(<Row />, { tone: 'inverse' })
    const rule = getByTestId('row').lastElementChild as HTMLElement

    expect(getComputedStyle(rule).backgroundColor).toBe(resolvedColor('--inverse-rule'))
  })
})
