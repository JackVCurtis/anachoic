// Copied from anachoic inertia/components/patterns/section_header/section_header.test.tsx at fd99e0d
import { createRef } from 'react'
import { act, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { SectionHeader, type HeadingLevel } from './section_header'

function rootOf(title: string): HTMLElement {
  return screen.getByText(title).parentElement as HTMLElement
}

describe('SectionHeader', () => {
  test.each([1, 2, 3, 4, 5, 6] as HeadingLevel[])(
    'at section level the title is a heading of level %i',
    (level) => {
      renderComponent(<SectionHeader title="Queue" headingLevel={level} />)
      const heading = screen.getByRole('heading', { name: 'Queue' })

      expect(heading.tagName).toBe(`H${level}`)
      expect(screen.getAllByRole('heading')).toHaveLength(1)
    }
  )

  test('at label level there is no heading, only text', () => {
    renderComponent(<SectionHeader level="label" title="Repo" />)

    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('Repo').tagName).toBe('SPAN')
  })

  test('at label level it can be the legend that names its fieldset', () => {
    renderComponent(
      <fieldset>
        <SectionHeader level="label" element="legend" title="Register a repo" />
        <input aria-label="Path" />
      </fieldset>
    )
    const group = screen.getByRole('group', { name: 'Register a repo' })

    expect(group.firstElementChild?.tagName).toBe('LEGEND')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  test('the heading takes focus from a script and is not in the Tab order', async () => {
    const headingRef = createRef<HTMLHeadingElement>()
    const { user } = renderComponent(
      <>
        <button type="button">Before</button>
        <SectionHeader
          title="Your turn"
          headingLevel={2}
          headingRef={headingRef}
          trailing={<button type="button">Copy all commands</button>}
        />
      </>
    )
    const heading = screen.getByRole('heading', { name: 'Your turn' })

    expect(headingRef.current).toBe(heading)
    act(() => headingRef.current?.focus())
    expect(document.activeElement).toBe(heading)

    screen.getByRole('button', { name: 'Before' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy all commands' }))
    expect(heading.tabIndex).toBe(-1)
  })

  test('with a rule the parts are centred, without one they share a baseline', () => {
    renderComponent(
      <>
        <SectionHeader title="Queue" headingLevel={2} />
        <SectionHeader title="Workflows" headingLevel={2} rule={false} />
      </>
    )

    expect(getComputedStyle(rootOf('Queue')).alignItems).toBe('center')
    expect(rootOf('Queue').querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(getComputedStyle(rootOf('Workflows')).alignItems).toBe('baseline')
    expect(rootOf('Workflows').querySelector('[aria-hidden="true"]')).toBeNull()
  })

  test('compact spacing is --space-2 and roomy is --space-3', () => {
    renderComponent(
      <>
        <SectionHeader title="Queue" headingLevel={2} />
        <SectionHeader title="Agents" headingLevel={2} spacing="roomy" />
      </>
    )

    expect(getComputedStyle(rootOf('Queue')).columnGap).toBe('6.8px')
    expect(getComputedStyle(rootOf('Agents')).columnGap).toBe('10.2px')
  })

  test('the title has no margin; md is 12px and sm is 11px', () => {
    renderComponent(
      <>
        <SectionHeader title="Queue" headingLevel={2} />
        <SectionHeader title="Handoff chain" headingLevel={3} size="sm" />
      </>
    )
    const md = getComputedStyle(screen.getByText('Queue'))
    const sm = getComputedStyle(screen.getByText('Handoff chain'))

    expect(md.margin).toBe('0px')
    expect(md.fontSize).toBe('12px')
    expect(md.textTransform).toBe('uppercase')
    expect(sm.fontSize).toBe('11px')
  })

  test('the count is text-count in --color-text-subtle', () => {
    renderComponent(<SectionHeader title="Queue" headingLevel={2} summary={3} />)
    const count = screen.getByText('3')

    expect(count.classList.contains('text-count')).toBe(true)
    expect(getComputedStyle(count).color).toBe(resolvedColor('--color-text-subtle'))
  })

  test('a note is subtle, or --color-text-accent when asked, and sits at the end of the row', () => {
    renderComponent(
      <div style={{ width: 400 }}>
        <SectionHeader
          title="Handoff chain"
          headingLevel={3}
          note="click a step"
          noteType="status"
        />
        <SectionHeader
          level="label"
          title="Chain preview"
          rule={false}
          note="4 steps · 2 for you"
          noteAccent
        />
      </div>
    )
    const status = screen.getByText('click a step')
    const chainNote = screen.getByText('4 steps · 2 for you')
    const row = rootOf('Chain preview')

    expect(status.classList.contains('text-status')).toBe(true)
    expect(getComputedStyle(status).color).toBe(resolvedColor('--color-text-subtle'))
    expect(chainNote.classList.contains('text-note')).toBe(true)
    expect(getComputedStyle(chainNote).color).toBe(resolvedColor('--color-text-accent'))
    expect(Math.round(chainNote.getBoundingClientRect().right)).toBe(
      Math.round(row.getBoundingClientRect().right)
    )
  })

  test('the accent label has an accent-800 title and an accent-300 rule', () => {
    renderComponent(<SectionHeader level="label" accent title="Follow-up task" />)
    const title = screen.getByText('Follow-up task')
    const rule = rootOf('Follow-up task').querySelector('[aria-hidden="true"]') as HTMLElement

    expect(getComputedStyle(title).color).toBe(resolvedColor('--color-accent-800'))
    expect(getComputedStyle(rule).backgroundColor).toBe(resolvedColor('--color-accent-300'))
  })

  test('a plain label is text-label in --color-text-subtle', () => {
    renderComponent(<SectionHeader level="label" title="Repo" />)
    const title = screen.getByText('Repo')

    expect(title.classList.contains('text-label')).toBe(true)
    expect(getComputedStyle(title).color).toBe(resolvedColor('--color-text-subtle'))
  })
})
