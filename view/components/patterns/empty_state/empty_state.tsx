// Copied from anachoic inertia/components/patterns/empty_state/empty_state.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import { Frame } from '../../primitives/frame/frame'
import styles from './empty_state.module.css'

export type EmptyStateVariant = 'dashed' | 'framed'

export interface EmptyStateProps {
  variant: EmptyStateVariant
  /** Sentence case. CSS shows it in uppercase. */
  message: string
  /** Placement only. */
  className?: string
}

/**
 * Says that a list has nothing in it.
 */
export function EmptyState({ variant, message, className }: EmptyStateProps) {
  const dashed = variant === 'dashed'
  return (
    <Frame
      line={dashed ? 'dashed' : 'solid'}
      className={joinClasses(styles.box, dashed ? styles.dashed : styles.framed, className)}
    >
      <p className={joinClasses(dashed ? styles.dashedText : 'text-name', styles.message)}>
        {message}
      </p>
    </Frame>
  )
}
