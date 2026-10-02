/**
 * A Testing Library matcher for text drawn across several elements, as
 * SymbolText draws a line whose symbols are hidden: the innermost element
 * whose whole text is `text`.
 */
export function fullText(text: string) {
  return (_content: string, element: Element | null) =>
    element !== null &&
    element.textContent === text &&
    ![...element.children].some((child) => child.textContent === text)
}

/**
 * Text as assistive technology reads it once SymbolText hides its symbols:
 * without them, and with its spaces collapsed, as an accessible name is.
 */
export function spoken(text: string) {
  return text
    .replace(/[↗→←·×⇧]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
