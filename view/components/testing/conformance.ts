/**
 * Checks of 07's view rules and anachoic's accessibility rules that hold for
 * every view, run by each view's conformance test.
 */

/** WCAG 2.5.8: a target is at least 24 by 24 CSS pixels. */
export const MIN_TARGET = 24

/**
 * The characters that are not words (anachoic ui/16): each is hidden from
 * assistive technology wherever it is drawn.
 */
export const NOT_WORDS = ['↗', '→', '←', '·', '—', '×', '⇧'] as const

/**
 * Each text node under `root` that shows a character that is not a word
 * without an `aria-hidden` ancestor, as "character in “text”".
 */
export function unhiddenSymbols(root: Element): string[] {
  const found: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    const hidden = node.parentElement?.closest('[aria-hidden="true"]')
    for (const symbol of NOT_WORDS) {
      if (text.includes(symbol) && !hidden) {
        found.push(`${symbol} in “${text}”`)
      }
    }
  }
  return found
}

/**
 * Each element under `root` that scrolls on its own: 07 allows no inner
 * scroll region. Text fields scroll their own text and are left out.
 */
export function innerScrollRegions(root: Element): Element[] {
  return [...root.querySelectorAll('*')].filter((element) => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return false
    }
    const { overflowX, overflowY } = getComputedStyle(element)
    return [overflowX, overflowY].some((overflow) => overflow === 'auto' || overflow === 'scroll')
  })
}

/** A target's measured size, for a failure message that names it. */
export function targetSize(element: Element) {
  const { width, height } = element.getBoundingClientRect()
  return { name: element.textContent?.trim() || element.getAttribute('aria-label'), width, height }
}
