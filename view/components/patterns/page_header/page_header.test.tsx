// Copied from anachoic inertia/components/patterns/page_header/page_header.test.tsx at fd99e0d
import { createRef } from 'react'
import { act, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { PageHeader } from './page_header'
import { fullText } from '../../testing/text'

describe('PageHeader', () => {
  test('the title is the page h1 and the summary follows on one baseline', () => {
    renderComponent(<PageHeader title="Completed" summary="412 tasks · hidden from the board" />)
    const title = screen.getByRole('heading', { level: 1, name: 'Completed' })
    const summary = screen.getByText(fullText('412 tasks · hidden from the board'))
    const row = getComputedStyle(title.parentElement as HTMLElement)

    expect(title.classList.contains('text-title-page')).toBe(true)
    expect(getComputedStyle(title).margin).toBe('0px')
    expect(row.alignItems).toBe('baseline')
    expect(row.columnGap).toBe('13.6px')
    expect(summary.classList.contains('text-body-sm')).toBe(true)
    expect(getComputedStyle(summary).color).toBe(resolvedColor('--color-text-faint'))
  })

  test('the title takes focus from a script and is not in the Tab order', async () => {
    const titleRef = createRef<HTMLHeadingElement>()
    const { user } = renderComponent(
      <>
        <button type="button">Before</button>
        <PageHeader title="Sign off" summary="All caught up" titleRef={titleRef} />
        <button type="button">After</button>
      </>
    )
    const title = screen.getByRole('heading', { level: 1 })

    expect(titleRef.current).toBe(title)
    act(() => titleRef.current?.focus())
    expect(document.activeElement).toBe(title)

    screen.getByRole('button', { name: 'Before' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }))
    expect(title.tabIndex).toBe(-1)
  })
})
