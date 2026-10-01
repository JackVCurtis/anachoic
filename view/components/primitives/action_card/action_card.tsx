// Copied from anachoic inertia/components/primitives/action_card/action_card.tsx at fd99e0d
import type { ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import type { Tone } from '../../types'
import { Frame } from '../frame/frame'
import styles from './action_card.module.css'

export type ActionCardElement = 'div' | 'article' | 'li'

export type ActionCardHeadingLevel = 2 | 3 | 4

export interface ActionCardProps {
  /** The title text. The main action is a button that wraps it. */
  'title': string
  /** The id of the main action, so a nested control can be described by the title. */
  'titleId'?: string
  /** `inverse` is passed to the frame. Selected and lifted apply to the light tone only. */
  'tone'?: Tone
  'selected'?: boolean
  /** The card is being moved to another place in its list. */
  'lifted'?: boolean
  /** The heading around the main action, or none. */
  'headingLevel'?: ActionCardHeadingLevel | null
  'element'?: ActionCardElement
  /** Set when the main action opens the task drawer. */
  'aria-haspopup'?: 'dialog'
  'onAction': () => void
  /** Content drawn before the title. */
  'leading'?: ReactNode
  /** Padding, gap and inner layout of the card. Never color, border or type. */
  'className'?: string
  /** The title's text style and placement. */
  'titleClassName'?: string
  /** Content drawn after the title. Links, buttons, fields and code in it are raised above the main action's hit area. */
  'children'?: ReactNode
}

/**
 * A frame whose main action covers the card. The main action is a button on
 * the title, and its hit area is stretched over the frame; the nested
 * controls are its siblings, raised above that hit area, so a press lands on
 * exactly one of them.
 */
export function ActionCard({
  title,
  titleId,
  tone = 'light',
  selected = false,
  lifted = false,
  headingLevel = 3,
  element = 'article',
  'aria-haspopup': hasPopup,
  onAction,
  leading,
  className,
  titleClassName,
  children,
}: ActionCardProps) {
  const light = tone === 'light'
  const action = (
    <button
      type="button"
      id={titleId}
      aria-haspopup={hasPopup}
      onClick={() => onAction()}
      className={joinClasses(styles.action, headingLevel === null && titleClassName)}
    >
      {title}
    </button>
  )
  const Heading = headingLevel === null ? null : (`h${headingLevel}` as const)

  return (
    <Frame
      tone={tone}
      element={element}
      fill={light && (selected || lifted) ? 'tint' : 'none'}
      emphasis={light && lifted ? 'selected' : 'default'}
      className={joinClasses(styles.card, light && styles.light, className)}
    >
      {leading}
      {Heading ? <Heading className={titleClassName}>{action}</Heading> : action}
      {children}
    </Frame>
  )
}
