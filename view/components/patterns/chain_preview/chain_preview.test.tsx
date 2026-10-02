// Copied from anachoic inertia/components/patterns/chain_preview/chain_preview.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { LONG_TEXT } from '../../fixtures/long_text'
import { AGENT_ASKS, TWELVE_STEPS, type PipStepSample } from '../../fixtures/pip_steps'
import type { ChainPreviewRow } from '../../helpers/steps'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { ChainPreview } from './chain_preview'

/**
 * A new task's four steps, two of them yours. No session holds any of them.
 */
const NEW_TASK: readonly ChainPreviewRow[] = [
  { number: 1, owner: 'agent', title: 'Draft the migration' },
  { number: 2, owner: 'you', title: 'Review the migration' },
  { number: 3, owner: 'agent', title: 'Run it on staging' },
  { number: 4, owner: 'you', title: 'Run it in production' },
]

function rowsOf(steps: readonly PipStepSample[]): ChainPreviewRow[] {
  return steps.map(({ owner, title, sessionName }, index) => ({
    number: index + 1,
    owner,
    title,
    sessionName,
  }))
}

function items(): HTMLElement[] {
  return screen.getAllByRole('listitem')
}

function numbers(): string[] {
  return items().map((item) => item.firstElementChild?.textContent ?? '')
}

function chips(): string[] {
  return items().map((item) => item.children[1]?.textContent ?? '')
}

function rowGap(list: HTMLElement): number {
  const [first, second] = [...list.children].map((child) => child.getBoundingClientRect())
  return second.top - first.bottom
}

describe('ChainPreview', () => {
  test('a bare preview starting at 5 is an ol with start="5" numbered 05, 06', () => {
    renderComponent(
      <ChainPreview
        variant="bare"
        steps={NEW_TASK.map((row) => ({ ...row, number: row.number + 4 }))}
      />
    )
    const list = screen.getByRole('list')

    expect(list.tagName).toBe('OL')
    expect(list.getAttribute('start')).toBe('5')
    expect(numbers().slice(0, 2)).toEqual(['05', '06'])
    expect(numbers()).toHaveLength(NEW_TASK.length)
  })

  test('bare has no frame and no header, rows --gap-rows apart', () => {
    renderComponent(<ChainPreview variant="bare" steps={NEW_TASK} />)
    const list = screen.getByRole('list')

    expect(screen.queryByText('Chain preview')).toBeNull()
    expect(getComputedStyle(list).borderTopStyle).toBe('none')
    expect(getComputedStyle(list).rowGap).toBe('5px')
    expect(rowGap(list)).toBeCloseTo(5, 0)
  })

  test('framed: a frame padded --space-3, the header with the chain note, rows 6px apart', () => {
    renderComponent(<ChainPreview variant="framed" steps={NEW_TASK} />)
    const list = screen.getByRole('list', { name: 'Chain preview' })
    const frame = list.parentElement as HTMLElement
    const note = screen.getByText('4 steps · 2 for you')
    const space3 = getComputedStyle(document.documentElement).getPropertyValue('--space-3').trim()

    expect(list.getAttribute('start')).toBe('1')
    expect(numbers()).toEqual(['01', '02', '03', '04'])
    expect(getComputedStyle(frame).borderTopStyle).toBe('solid')
    expect(Number.parseFloat(getComputedStyle(frame).paddingTop)).toBeCloseTo(
      Number.parseFloat(space3),
      1
    )
    expect(getComputedStyle(frame).rowGap).toBe('6px')
    expect(rowGap(list)).toBeCloseTo(6, 0)
    expect(note.classList.contains('text-note')).toBe(true)
    expect(getComputedStyle(note).color).toBe(resolvedColor('--color-text-accent', note))
  })

  test('a row: baseline aligned with a --space-2 gap; mono 10.5px subtle number, sm chip, 12px title', () => {
    renderComponent(<ChainPreview variant="framed" steps={NEW_TASK} />)
    const [row] = items()
    const [number, chip, title] = [...row.children] as HTMLElement[]
    const space2 = getComputedStyle(document.documentElement).getPropertyValue('--space-2').trim()

    expect(getComputedStyle(row).alignItems).toBe('baseline')
    expect(Number.parseFloat(getComputedStyle(row).columnGap)).toBeCloseTo(
      Number.parseFloat(space2),
      1
    )
    expect(getComputedStyle(number).fontSize).toBe('10.5px')
    expect(getComputedStyle(number).fontFamily).toContain('monospace')
    expect(getComputedStyle(number).color).toBe(resolvedColor('--color-text-subtle', number))
    expect(chip.textContent).toBe('agent')
    expect(getComputedStyle(chip).paddingLeft).toBe('6px')
    expect(within(row).getByText(NEW_TASK[0].title)).toBe(title)
    expect(getComputedStyle(title).fontSize).toBe('12px')
  })

  test('a row with a session shows the named chip, and a row without one the generic chip', () => {
    renderComponent(<ChainPreview variant="framed" steps={rowsOf(AGENT_ASKS)} />)

    expect(chips()).toEqual(['api-server', 'api-server', 'you'])

    renderComponent(<ChainPreview variant="bare" steps={NEW_TASK} />)
    expect(chips().slice(3)).toEqual(['agent', 'you', 'agent', 'you'])
  })

  test('twelve steps number 01 to 12', () => {
    renderComponent(<ChainPreview variant="framed" steps={rowsOf(TWELVE_STEPS)} />)

    expect(numbers()).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')))
  })

  test('a title of 120 characters wraps inside the row', () => {
    renderComponent(
      <div style={{ width: 308 }}>
        <ChainPreview
          variant="framed"
          steps={[{ number: 1, owner: 'agent', title: LONG_TEXT.title }]}
        />
      </div>
    )
    const [row] = items()
    const title = within(row).getByText(LONG_TEXT.title)

    expect(title.getBoundingClientRect().height).toBeGreaterThan(30)
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  })
})
