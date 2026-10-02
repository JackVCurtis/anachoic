// Copied from anachoic inertia/components/primitives/frame/frame.tsx at fd99e0d
import type { HTMLAttributes, ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import type { Tone } from '../../types'
import styles from './frame.module.css'

export type FrameLine = 'solid' | 'dashed'

export type FrameEmphasis = 'default' | 'muted' | 'selected'

export type FrameFill = 'none' | 'tint' | 'hatch'

export type FrameElement = 'div' | 'article' | 'section' | 'li'

export interface FrameProps extends Omit<HTMLAttributes<HTMLElement>, 'style' | 'className'> {
  /** `inverse` paints the inverted field and sets the tone scope for everything inside. */
  tone?: Tone
  line?: FrameLine
  emphasis?: FrameEmphasis
  fill?: FrameFill
  element?: FrameElement
  /** Placement, padding and inner layout only. Never color, border or type. */
  className?: string
  children?: ReactNode
}

/**
 * The square hairline box. It has no padding of its own.
 */
export function Frame({
  tone = 'light',
  line = 'solid',
  emphasis = 'default',
  fill = 'none',
  element: Element = 'div',
  className,
  children,
  ...attributes
}: FrameProps) {
  return (
    <Element
      {...attributes}
      data-tone={tone === 'inverse' ? 'inverse' : fill === 'tint' ? 'light' : undefined}
      className={joinClasses(
        styles.frame,
        tone === 'inverse' && styles.inverse,
        line === 'dashed' && styles.dashed,
        emphasis === 'muted' && styles.muted,
        emphasis === 'selected' && styles.selected,
        fill === 'tint' && styles.tint,
        fill === 'hatch' && styles.hatch,
        className
      )}
    >
      {children}
    </Element>
  )
}
