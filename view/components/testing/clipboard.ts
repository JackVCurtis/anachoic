// Copied from anachoic inertia/components/testing/clipboard.ts at fd99e0d
export type WriteText = (text: string) => Promise<void>

/**
 * Replaces `navigator.clipboard` with one whose `writeText` is the function
 * given, usually a mock. Returns a function that puts the real clipboard
 * back. `userEvent.setup()`, which `renderComponent` calls, puts its own
 * clipboard in the same place, so a test installs this after rendering.
 */
export function installClipboard(writeText: WriteText): () => void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return () => {
    Reflect.deleteProperty(navigator, 'clipboard')
  }
}

/** What the clipboard says to a write: it succeeds, or the browser refuses it. */
export function clipboardAnswer(answer: 'resolve' | 'reject'): WriteText {
  return () =>
    answer === 'resolve'
      ? Promise.resolve()
      : Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
}
