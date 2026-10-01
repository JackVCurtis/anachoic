// Copied from anachoic inertia/components/primitives/status_square/status_square.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import styles from './status_square.module.css'

export const STATUS_SQUARE_STATES = ['attention', 'busy', 'running', 'waiting', 'idle'] as const

export type StatusSquareState = (typeof STATUS_SQUARE_STATES)[number]

export interface StatusSquareProps {
  /**
   * `attention` blinks in the tone's foreground; `busy` blinks in the accent.
   * `running`, `waiting` and `idle` are still.
   */
  state: StatusSquareState
  /** Placement only. */
  className?: string
}

/**
 * A decorative 7px square that marks a state. The label beside it carries the
 * meaning, so it is hidden from assistive technology.
 */
export function StatusSquare({ state, className }: StatusSquareProps) {
  return (
    <span aria-hidden="true" className={joinClasses(styles.square, styles[state], className)} />
  )
}
