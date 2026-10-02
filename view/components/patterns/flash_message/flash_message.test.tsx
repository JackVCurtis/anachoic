// Copied from anachoic inertia/components/patterns/flash_message/flash_message.test.tsx at fd99e0d
import { act, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { MESSAGES } from '../../fixtures/messages'
import { FLASH_MS } from '../../helpers/constants'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { FlashMessage, type FlashMessageData } from './flash_message'
import { FlashMessages } from './flash_messages'

/**
 * Only the clock the count reads is faked. The browser user-event commands
 * run through Playwright and are not held up by it.
 */
function useFakeClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/**
 * Runs a browser input inside act, so React applies the updates it causes
 * before the test reads the result.
 */
async function inAct(input: () => Promise<unknown>) {
  await act(async () => {
    await input()
  })
}

function renderMessage(message: FlashMessageData, focusTarget = createRef<HTMLElement>()) {
  const onDismiss = vi.fn()
  const result = renderComponent(
    <>
      <FlashMessage {...message} onDismiss={onDismiss} focusTarget={focusTarget} />
      <button type="button">Outside</button>
    </>
  )
  const rerender = (next: FlashMessageData) =>
    result.rerender(
      <>
        <FlashMessage {...next} onDismiss={onDismiss} focusTarget={focusTarget} />
        <button type="button">Outside</button>
      </>
    )
  return {
    ...result,
    rerender,
    onDismiss,
    dismiss: screen.getByRole('button', { name: 'Dismiss' }),
    outside: screen.getByRole('button', { name: 'Outside' }),
  }
}

function stripOf(element: Element): HTMLElement {
  return element.closest('[data-kind]') as HTMLElement
}

describe('FlashMessage', () => {
  describe('the count', () => {
    beforeEach(useFakeClock)
    afterEach(() => {
      vi.useRealTimers()
    })

    test('a success calls onDismiss with its id after 6 seconds', () => {
      const { onDismiss } = renderMessage(MESSAGES.success)

      advance(FLASH_MS - 1)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(onDismiss).toHaveBeenCalledWith(MESSAGES.success.id)
    })

    test('the pointer over the strip holds the count, and leaving resumes it', async () => {
      const { onDismiss, dismiss } = renderMessage(MESSAGES.success)

      advance(2000)
      await inAct(() => userEvent.hover(stripOf(dismiss)))
      advance(FLASH_MS * 3)
      expect(onDismiss).not.toHaveBeenCalled()

      await inAct(() => userEvent.unhover(stripOf(dismiss)))
      advance(FLASH_MS - 2000 - 1)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledOnce()
    })

    test('focus inside the strip holds the count, and leaving resumes it', async () => {
      const { onDismiss, outside } = renderMessage(MESSAGES.success)

      advance(3000)
      await inAct(() => userEvent.keyboard('{Tab}'))
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss' }))
      advance(FLASH_MS * 3)
      expect(onDismiss).not.toHaveBeenCalled()

      await inAct(() => userEvent.keyboard('{Tab}'))
      expect(document.activeElement).toBe(outside)
      advance(FLASH_MS - 3000 - 1)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledOnce()
    })

    test('an error stays past 6 seconds and leaves only on Dismiss', async () => {
      const { onDismiss, dismiss } = renderMessage(MESSAGES.error)

      advance(FLASH_MS * 10)
      expect(onDismiss).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toBeTruthy()

      await inAct(() => userEvent.click(dismiss))
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(onDismiss).toHaveBeenCalledWith(MESSAGES.error.id)
    })

    test('a new id restarts the count and the announcement, even with the same words', () => {
      const { onDismiss, rerender } = renderMessage(MESSAGES.success)
      const region = screen.getByRole('status')
      const words = screen.getByText(MESSAGES.success.text)

      advance(FLASH_MS - 1000)
      rerender({ ...MESSAGES.success, id: 'message-4' })

      expect(screen.getByRole('status')).toBe(region)
      const newWords = screen.getByText(MESSAGES.success.text)
      expect(newWords).not.toBe(words)
      expect(words.isConnected).toBe(false)
      expect(region.contains(newWords)).toBe(true)

      advance(FLASH_MS - 1)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(onDismiss).toHaveBeenCalledWith('message-4')
    })

    test('the same id seen again keeps its count and its words', () => {
      const { onDismiss, rerender } = renderMessage(MESSAGES.success)
      const words = screen.getByText(MESSAGES.success.text)

      advance(FLASH_MS - 1000)
      rerender({ ...MESSAGES.success })
      expect(screen.getByText(MESSAGES.success.text)).toBe(words)
      advance(1000)
      expect(onDismiss).toHaveBeenCalledOnce()
    })

    test('the timer after Dismiss does not raise it a second time', async () => {
      const { onDismiss, dismiss } = renderMessage(MESSAGES.success)

      await inAct(() => userEvent.click(dismiss))
      await inAct(() => userEvent.unhover(dismiss))
      advance(FLASH_MS * 2)
      expect(onDismiss).toHaveBeenCalledOnce()
    })
  })

  test('a success is a polite status; an error is an alert', () => {
    renderComponent(
      <FlashMessages messages={[MESSAGES.success, MESSAGES.error]} onDismiss={() => {}} />
    )
    const status = screen.getByRole('status')
    const alert = screen.getByRole('alert')

    expect(status.textContent).toBe(`Done ${MESSAGES.success.text}`)
    expect(alert.textContent).toBe(`Error ${MESSAGES.error.text}`)
    expect(status.contains(screen.getAllByRole('button')[0])).toBe(false)
    expect(alert.contains(screen.getAllByRole('button')[1])).toBe(false)
  })

  test('focus does not move to the strip when it appears', async () => {
    const onDismiss = vi.fn()
    const { rerender } = renderComponent(<button type="button">Mark done</button>)
    const markDone = screen.getByRole('button', { name: 'Mark done' })
    await inAct(() => userEvent.click(markDone))
    expect(document.activeElement).toBe(markDone)

    rerender(
      <>
        <button type="button">Mark done</button>
        <FlashMessages messages={[MESSAGES.error, MESSAGES.success]} onDismiss={onDismiss} />
      </>
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(document.activeElement).toBe(markDone)
  })

  test.each(['{Enter}', ' '])(
    'dismissing with %j from the keyboard moves focus to the supplied target',
    async (key) => {
      const target = createRef<HTMLHeadingElement>()
      const onDismiss = vi.fn()
      renderComponent(
        <>
          <FlashMessage {...MESSAGES.error} onDismiss={onDismiss} focusTarget={target} />
          <h2 ref={target} tabIndex={-1}>
            Board
          </h2>
        </>
      )

      await inAct(() => userEvent.keyboard('{Tab}'))
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss' }))
      await inAct(() => userEvent.keyboard(key))
      expect(onDismiss).toHaveBeenCalledWith(MESSAGES.error.id)
      expect(document.activeElement).toBe(screen.getByRole('heading'))
    }
  )

  test('dismissing with the pointer leaves focus where the press put it', async () => {
    const target = createRef<HTMLElement>()
    const { dismiss, onDismiss } = renderMessage(MESSAGES.error, target)
    const heading = document.createElement('h2')
    heading.tabIndex = -1
    document.body.append(heading)
    target.current = heading

    await inAct(() => userEvent.click(dismiss))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(dismiss)
    await inAct(() => userEvent.unhover(dismiss))
    heading.remove()
  })

  test('the ordering wrapper draws an error above a success', () => {
    renderComponent(
      <FlashMessages messages={[MESSAGES.success, MESSAGES.error]} onDismiss={() => {}} />
    )

    const [first, second] = Array.from(document.querySelectorAll('[data-kind]'))
    expect(first.getAttribute('data-kind')).toBe('error')
    expect(second.getAttribute('data-kind')).toBe('success')
  })

  test('the ordering wrapper reuses a strip for a message that replaces one of its kind', () => {
    const { rerender } = renderComponent(
      <FlashMessages messages={[MESSAGES.success]} onDismiss={() => {}} />
    )
    const region = screen.getByRole('status')

    rerender(
      <FlashMessages messages={[{ ...MESSAGES.success, id: 'message-9' }]} onDismiss={() => {}} />
    )
    expect(screen.getByRole('status')).toBe(region)
  })

  test.each([
    {
      kind: 'success',
      message: MESSAGES.success,
      fill: '--color-accent-100',
      rule: '--color-accent-300',
      text: '--color-text-on-tint',
    },
    {
      kind: 'error',
      message: MESSAGES.error,
      fill: null,
      rule: '--color-text',
      text: '--color-text',
    },
  ])('$kind has its fill, rules and text', ({ message, fill, rule, text }) => {
    const { dismiss } = renderMessage(message)
    const strip = stripOf(dismiss)
    const style = getComputedStyle(strip)

    expect(style.backgroundColor).toBe(fill ? resolvedColor(fill) : 'rgba(0, 0, 0, 0)')
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderBottomWidth).toBe('1px')
    expect(style.borderLeftWidth).toBe('0px')
    expect(style.borderTopColor).toBe(resolvedColor(rule))
    expect(style.borderBottomColor).toBe(resolvedColor(rule))
    expect(style.color).toBe(resolvedColor(text))
    expect(getComputedStyle(screen.getByText(/^(Done|Error)$/)).color).toBe(resolvedColor(text))
    expect(getComputedStyle(dismiss).color).toBe(resolvedColor(text))
    expect(getComputedStyle(dismiss).borderTopColor).toBe(resolvedColor('--color-divider'))
  })

  test('the strip, the word and the message have their measurements', () => {
    const { dismiss } = renderMessage(MESSAGES.success)
    const strip = getComputedStyle(stripOf(dismiss))
    const word = getComputedStyle(screen.getByText('Done'))
    const text = getComputedStyle(screen.getByText(MESSAGES.success.text))

    expect(strip.display).toBe('flex')
    expect(strip.alignItems).toBe('center')
    expect(strip.columnGap).toBe('10.2px')
    expect(strip.padding).toBe('6.8px 20.4px')
    expect(word.fontSize).toBe('12px')
    expect(word.fontWeight).toBe('600')
    expect(word.textTransform).toBe('uppercase')
    expect(text.fontSize).toBe('13px')
    expect(dismiss.textContent).toBe('Dismiss')
    expect(getComputedStyle(dismiss).fontSize).toBe('11px')
  })

  test('the message takes the free width and wraps; the text is shown as given', () => {
    renderComponent(
      <div style={{ width: 560 }}>
        <FlashMessage {...MESSAGES.long} onDismiss={() => {}} />
      </div>
    )
    const text = screen.getByText(MESSAGES.long.text)
    const dismiss = screen.getByRole('button', { name: 'Dismiss' })

    expect(text.textContent).toBe(MESSAGES.long.text)
    expect(text.getBoundingClientRect().height).toBeGreaterThan(30)
    expect(dismiss.getBoundingClientRect().right).toBeLessThanOrEqual(560 - 20)
  })
})
