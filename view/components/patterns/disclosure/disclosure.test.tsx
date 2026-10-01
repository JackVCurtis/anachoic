// Copied from anachoic inertia/components/patterns/disclosure/disclosure.test.tsx at fd99e0d
import { act, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { renderComponent } from '../../testing/render'
import { Disclosure, type DisclosureProps } from './disclosure'

const SHOW = 'Show'
const HIDE = 'Hide'
const SHOW_ALL = 'Show all 14'

const PANEL_TEXT = 'The step prompt'
const INNER = 'Inside the panel'

async function inAct(input: () => Promise<unknown>) {
  await act(async () => {
    await input()
  })
}

interface HarnessProps extends Partial<Omit<DisclosureProps, 'open' | 'onToggle'>> {
  initiallyOpen?: boolean
  onToggle?: () => void
  onInner?: () => void
}

/** Owns the open state, as the list or block holding a disclosure does. */
function Harness({
  initiallyOpen = false,
  onToggle = () => {},
  onInner = () => {},
  ...props
}: HarnessProps) {
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <div data-testid="owner">
      <Disclosure
        toggle={open ? HIDE : SHOW}
        {...props}
        open={open}
        onToggle={() => {
          onToggle()
          setOpen(!open)
        }}
      >
        <p>{PANEL_TEXT}</p>
        <button type="button" onClick={onInner}>
          {INNER}
        </button>
      </Disclosure>
    </div>
  )
}

function toggle() {
  return screen.getByRole('button', { name: /^(Show|Hide)$/ })
}

function panel() {
  return screen.queryByText(PANEL_TEXT)?.parentElement ?? null
}

describe('Disclosure', () => {
  test('when closed the toggle says so and the panel is absent from the DOM', () => {
    renderComponent(<Harness />)

    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(toggle()).toHaveTextContent(SHOW)
    expect(panel()).toBeNull()
    expect(screen.queryByRole('button', { name: INNER })).toBeNull()
    expect(document.getElementById(toggle().getAttribute('aria-controls')!)).toBeNull()
  })

  test('when open aria-controls points at the panel id', () => {
    renderComponent(<Harness initiallyOpen />)
    const shown = panel()!

    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(shown.id).not.toBe('')
    expect(toggle().getAttribute('aria-controls')).toBe(shown.id)
    expect(shown.getAttribute('role')).toBeNull()
  })

  test('the panel keeps a given id', () => {
    renderComponent(<Harness initiallyOpen panelId="step-3-panel" />)

    expect(panel()!.id).toBe('step-3-panel')
    expect(toggle().getAttribute('aria-controls')).toBe('step-3-panel')
  })

  test('the panel is a sibling of the toggle, not inside it', () => {
    renderComponent(<Harness initiallyOpen />)

    expect(toggle().contains(panel())).toBe(false)
    expect(toggle().nextElementSibling).toBe(panel())
    expect(screen.getByTestId('owner').children).toHaveLength(2)
  })

  test('a click toggles it open and closed, and aria-expanded follows', async () => {
    const onToggle = vi.fn()
    renderComponent(<Harness onToggle={onToggle} />)

    await inAct(() => userEvent.click(toggle()))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(toggle()).toHaveTextContent(HIDE)
    expect(toggle().getAttribute('aria-controls')).toBe(panel()!.id)

    await inAct(() => userEvent.click(toggle()))
    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()
  })

  test.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s on the focused toggle calls onToggle', async (_key, keys) => {
    const onToggle = vi.fn()
    renderComponent(<Harness onToggle={onToggle} />)
    toggle().focus()

    await inAct(() => userEvent.keyboard(keys))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(toggle()).toHaveFocus()

    await inAct(() => userEvent.keyboard(keys))
    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  test('it does not decide open by itself: without the owner it stays as told', async () => {
    const onToggle = vi.fn()
    renderComponent(
      <Disclosure open={false} onToggle={onToggle} toggle={SHOW}>
        <p>{PANEL_TEXT}</p>
      </Disclosure>
    )

    await inAct(() => userEvent.click(toggle()))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()
  })

  test('pressing a button inside the open panel does not call onToggle', async () => {
    const onToggle = vi.fn()
    const onInner = vi.fn()
    renderComponent(<Harness initiallyOpen onToggle={onToggle} onInner={onInner} />)
    const inner = screen.getByRole('button', { name: INNER })

    await inAct(() => userEvent.click(inner))
    inner.focus()
    await inAct(() => userEvent.keyboard('{Enter}'))
    await inAct(() => userEvent.keyboard(' '))

    expect(onInner).toHaveBeenCalledTimes(3)
    expect(onToggle).not.toHaveBeenCalled()
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  test('the parent can place the toggle inside a heading', () => {
    renderComponent(<Harness initiallyOpen headingLevel={3} />)
    const heading = screen.getByRole('heading', { level: 3, name: HIDE })

    expect(toggle().parentElement).toBe(heading)
    expect(heading.contains(panel())).toBe(false)
    expect(heading.nextElementSibling).toBe(panel())
  })

  test('the toggle is a native button with no look of its own', () => {
    renderComponent(<Harness />)

    expect(toggle().tagName).toBe('BUTTON')
    expect(toggle().getAttribute('type')).toBe('button')
    expect(toggle().className).toBe('')
  })

  test('the toggle can be drawn with the Button primitive', async () => {
    const onToggle = vi.fn()
    renderComponent(<Harness onToggle={onToggle} toggle={SHOW_ALL} toggleVariant="utility" />)
    const button = screen.getByRole('button', { name: SHOW_ALL })
    expect(button.className).not.toBe('')

    await inAct(() => userEvent.click(button))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-controls')).toBe(panel()!.id)
  })
})
