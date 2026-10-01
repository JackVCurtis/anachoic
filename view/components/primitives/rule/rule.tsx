// Copied from anachoic inertia/components/primitives/rule/rule.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import styles from './rule.module.css'

export interface RuleProps {
  /** Draws the rule in --color-accent-300 instead of the tone's rule color. */
  accent?: boolean
  /** Placement only. */
  className?: string
}

/**
 * A decorative hairline that grows to fill the rest of its row.
 */
export function Rule({ accent = false, className }: RuleProps) {
  return (
    <span
      aria-hidden="true"
      className={joinClasses(styles.rule, accent && styles.accent, className)}
    />
  )
}
