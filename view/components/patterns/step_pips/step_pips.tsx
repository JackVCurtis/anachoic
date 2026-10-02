// Copied from anachoic inertia/components/patterns/step_pips/step_pips.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import { pipAppearance, pipSummary, pipTitle } from '../../helpers/steps'
import type { Owner, StepStatus } from '../../types'
import styles from './step_pips.module.css'

/**
 * `tight` is the 2px gap of most cards; `loose` the 4px gap of the sign-off card.
 */
export type StepPipsSpacing = 'tight' | 'loose'

export interface StepPip {
  id: string
  owner: Owner
  status: StepStatus
  title: string
  /** The session that holds the step, if any. Missing reads "agent". */
  sessionName: string | null
}

export interface StepPipsProps {
  /** In chain order. */
  steps: readonly StepPip[]
  spacing?: StepPipsSpacing
  /** Placement only. */
  className?: string
}

/**
 * A chain at a glance: one bar per step, each as wide as the others. Its
 * colors come from the tone scope it sits in.
 */
export function StepPips({ steps, spacing = 'tight', className }: StepPipsProps) {
  return (
    <div
      role="img"
      aria-label={pipSummary(steps)}
      className={joinClasses(styles.row, spacing === 'loose' && styles.loose, className)}
    >
      {steps.map((step) => {
        const appearance = pipAppearance(step.status, step.owner)
        return (
          <span
            key={step.id}
            aria-hidden="true"
            title={pipTitle(step.owner, step.sessionName, step.title)}
            data-appearance={appearance}
            className={joinClasses(styles.pip, styles[appearance])}
          />
        )
      })}
    </div>
  )
}
