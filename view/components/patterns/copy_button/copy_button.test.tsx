// Copied from anachoic inertia/components/patterns/copy_button/copy_button.test.tsx at fd99e0d
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { COPIED_MS } from '../../helpers/constants'
import { copy } from '../../helpers/strings'
import { clipboardAnswer, installClipboard } from '../../testing/clipboard'
import { renderComponent } from '../../testing/render'
import { CopyButton, type CopyButtonProps } from './copy_button'

const TASK_ID = 'T-012'

/**
 * Only the timers the delay reads are faked. The browser user-event commands
 * run through Playwright and are not held up by them.
 */
function useFakeClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/**
 * Presses a button inside act and lets the clipboard's promise settle, so
 * React applies the updates the copy causes before the test reads them.
 */
async function press(button: HTMLElement) {
  await act(async () => {
    await userEvent.click(button)
    await Promise.resolve()
  })
}

let restoreClipboard = () => {}

/**
 * Called after rendering: the render sets up user-event, which puts its own
 * clipboard in place.
 */
function stubClipboard(answer: 'resolve' | 'reject' = 'resolve') {
  const writeText = vi.fn(clipboardAnswer(answer))
  restoreClipboard = installClipboard(writeText)
  return writeText
}

function renderButton(props: Partial<CopyButtonProps> = {}) {
  const onCopied = vi.fn()
  const result = renderComponent(
    <CopyButton
      text={TASK_ID}
      label={copy.copy}
      confirmedLabel={copy.copied}
      onCopied={onCopied}
      {...props}
    />
  )
  return { ...result, onCopied, button: screen.getByRole('button') }
}

beforeEach(() => {
  useFakeClock()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  restoreClipboard()
})

describe('a successful copy', () => {
  test('writes the text and flips to "Copied", then back after 1.4 seconds', async () => {
    const { button, onCopied } = renderButton()
    const writeText = stubClipboard()

    await press(button)

    expect(writeText).toHaveBeenCalledWith(TASK_ID)
    expect(onCopied).toHaveBeenCalledTimes(1)
    expect(button).toHaveTextContent('Copied')

    advance(COPIED_MS - 1)
    expect(button).toHaveTextContent('Copied')

    advance(1)
    expect(button).toHaveTextContent('Copy')
    expect(button).not.toHaveTextContent('Copied')
  })

  test('a second press within the delay copies again and restarts it', async () => {
    const { button, onCopied } = renderButton()
    const writeText = stubClipboard()

    await press(button)
    advance(1000)
    await press(button)

    expect(writeText).toHaveBeenCalledTimes(2)
    expect(onCopied).toHaveBeenCalledTimes(2)

    advance(1000)
    expect(button).toHaveTextContent('Copied')

    advance(COPIED_MS - 1000)
    expect(button).not.toHaveTextContent('Copied')
  })
})

describe('a failed copy', () => {
  test('a rejected clipboard write leaves the label as "Copy"', async () => {
    const { button, onCopied } = renderButton()
    stubClipboard('reject')

    await press(button)

    expect(button).toHaveTextContent('Copy')
    expect(button).not.toHaveTextContent('Copied')
    expect(onCopied).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})

describe('state', () => {
  test('two copy buttons confirm independently', async () => {
    renderComponent(
      <>
        <CopyButton text="T-015" label="Copy" confirmedLabel="Copied" />
        <CopyButton text={TASK_ID} label={copy.copyAll} confirmedLabel={copy.copiedAll} use="all" />
      </>
    )
    stubClipboard()
    const [first, second] = screen.getAllByRole('button')

    await press(first)
    advance(700)
    await press(second)

    expect(first).toHaveTextContent('Copied')
    expect(second).toHaveTextContent('Copied all')

    advance(700)
    expect(first).toHaveTextContent(/^Copy$/)
    expect(second).toHaveTextContent('Copied all')

    advance(700)
    expect(second).toHaveTextContent('Copy all IDs')
  })

  test('unmounting during the delay raises no warning and leaves no timer', async () => {
    const error = vi.spyOn(console, 'error')
    const warn = vi.spyOn(console, 'warn')
    const { button, unmount } = renderButton()
    stubClipboard()

    await press(button)
    unmount()

    expect(vi.getTimerCount()).toBe(0)
    advance(COPIED_MS * 2)
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  test('unmounting before the clipboard answers raises no warning', async () => {
    const error = vi.spyOn(console, 'error')
    const { button, unmount, onCopied } = renderButton()
    let finish = () => {}
    restoreClipboard = installClipboard(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )

    await act(async () => {
      await userEvent.click(button)
    })
    unmount()
    await act(async () => {
      finish()
      await Promise.resolve()
    })

    advance(COPIED_MS * 2)
    expect(onCopied).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })
})

describe('variants', () => {
  test('for one id it is the small utility button', () => {
    const { button } = renderButton()

    expect(getComputedStyle(button).textTransform).toBe('uppercase')
    expect(getComputedStyle(button).fontSize).toBe('11px')
  })

  test('"Copy all IDs" is the small secondary button', () => {
    const { button } = renderButton({
      label: copy.copyAll,
      confirmedLabel: copy.copiedAll,
      use: 'all',
    })

    expect(button).toHaveTextContent('Copy all IDs')
    expect(getComputedStyle(button).textTransform).toBe('none')
    expect(getComputedStyle(button).fontSize).toBe('12px')
  })

  test('its width follows the label', async () => {
    const { button } = renderButton({
      label: copy.copyAll,
      confirmedLabel: copy.copiedAll,
      use: 'all',
    })
    stubClipboard()
    const before = button.getBoundingClientRect().width

    await press(button)

    expect(button.getBoundingClientRect().width).toBeLessThan(before)
  })
})

describe('announcement', () => {
  test('the confirmed label is announced through a polite live region', async () => {
    const { button } = renderButton()
    stubClipboard()
    const region = screen.getByRole('status')

    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toBeEmptyDOMElement()

    await press(button)
    expect(region).toHaveTextContent('Copied')

    advance(COPIED_MS)
    expect(region).toBeEmptyDOMElement()
  })
})
