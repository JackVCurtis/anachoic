import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { LONG_TEXT } from '../fixtures/long_text'
import { renderComponent } from './render'
import { VIEW_WIDTHS, ViewFrame, windowOverflow, type ViewWidth } from './view_frame'

function Sample() {
  return (
    <section style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-6)' }}>
      <h2 className="text-title-4">{LONG_TEXT.title}</h2>
      <p className="text-body-sm">{LONG_TEXT.message}</p>
      <p className="text-name">{LONG_TEXT.name}</p>
    </section>
  )
}

describe('ViewFrame', () => {
  afterEach(async () => {
    await page.viewport(414, 896)
  })

  test.each(Object.keys(VIEW_WIDTHS) as ViewWidth[])(
    'a sample drawn at the %s width has no sideways overflow',
    async (width) => {
      await page.viewport(VIEW_WIDTHS[width], 900)
      const { container } = renderComponent(
        <ViewFrame width={width}>
          <Sample />
        </ViewFrame>
      )

      const frame = container.firstElementChild!
      expect(frame.getBoundingClientRect().width).toBe(VIEW_WIDTHS[width])
      const [sideways] = await windowOverflow()
      expect(sideways).toBe(0)
    }
  )

  test('the frame is as tall as its content, not the window', async () => {
    await page.viewport(VIEW_WIDTHS.inline, 900)
    const { container } = renderComponent(
      <ViewFrame>
        <div style={{ height: 120 }} />
      </ViewFrame>
    )

    expect(container.firstElementChild!.getBoundingClientRect().height).toBe(120)
  })
})
