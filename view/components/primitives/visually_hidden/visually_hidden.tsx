// Copied from anachoic inertia/components/primitives/visually_hidden/visually_hidden.tsx at fd99e0d
import type { HTMLAttributes, ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './visually_hidden.module.css'

/**
 * `h1` is for a screen whose title is heard and not seen, as the Board's and
 * Workflows' are.
 */
export type VisuallyHiddenElement = 'span' | 'h1'

export interface VisuallyHiddenProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'style' | 'className' | 'children'
> {
  children: ReactNode
  element?: VisuallyHiddenElement
  /** Placement only. */
  className?: string
}

/**
 * Text that a screen reader reads and the eye does not see. It stays in the
 * accessibility tree, so it is clipped to nothing rather than not displayed.
 */
export function VisuallyHidden({
  children,
  element: Element = 'span',
  className,
  ...attributes
}: VisuallyHiddenProps) {
  return (
    <Element {...attributes} className={joinClasses(styles.visuallyHidden, className)}>
      {children}
    </Element>
  )
}
