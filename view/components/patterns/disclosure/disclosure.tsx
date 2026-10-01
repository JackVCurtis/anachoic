// Copied from anachoic inertia/components/patterns/disclosure/disclosure.tsx at fd99e0d
import { useId, type ReactNode } from 'react'
import { Button, type ButtonSize, type LightButtonVariant } from '../../primitives/button/button'
import type { HeadingLevel } from '../section_header/section_header'

export interface DisclosureProps {
  open: boolean
  /** The toggle was pressed. The owner decides what opens and closes. */
  onToggle: () => void
  /** The toggle's content, including its visible word, such as "Show" or "Hide". */
  toggle: ReactNode
  /**
   * Draws the toggle as a `Button` of this variant. Without it the toggle is a
   * plain native `button` with no look of its own.
   */
  toggleVariant?: LightButtonVariant
  toggleSize?: ButtonSize
  /** The look of a plain toggle, or the placement of a `Button` toggle. */
  toggleClassName?: string
  /**
   * Puts the toggle inside a heading of this level, as the accordion pattern
   * does. The parent chooses the level from the screen's outline.
   */
  headingLevel?: HeadingLevel
  headingClassName?: string
  /** The panel's id. A generated one unless given. */
  panelId?: string
  panelClassName?: string
  /** The panel's content. It is rendered only while open. */
  children: ReactNode
}

/**
 * Wires a toggle button to the panel it shows and hides. The panel is the
 * toggle's sibling, never its child, so a control inside the panel cannot
 * trigger the toggle. Which disclosure of a list is open is the list's
 * business.
 */
export function Disclosure({
  open,
  onToggle,
  toggle,
  toggleVariant,
  toggleSize,
  toggleClassName,
  headingLevel,
  headingClassName,
  panelId,
  panelClassName,
  children,
}: DisclosureProps) {
  const generatedId = useId()
  const id = panelId ?? generatedId

  const button = toggleVariant ? (
    <Button
      variant={toggleVariant}
      size={toggleSize}
      aria-expanded={open}
      aria-controls={id}
      onPress={onToggle}
      className={toggleClassName}
    >
      {toggle}
    </Button>
  ) : (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
      className={toggleClassName}
    >
      {toggle}
    </button>
  )
  const Heading = headingLevel ? (`h${headingLevel}` as const) : null

  return (
    <>
      {Heading ? <Heading className={headingClassName}>{button}</Heading> : button}
      {open && (
        <div id={id} className={panelClassName}>
          {children}
        </div>
      )}
    </>
  )
}
