// Copied from anachoic inertia/components/patterns/busy_indicator/busy_indicator.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import { StatusSquare } from '../../primitives/status_square/status_square'
import styles from './busy_indicator.module.css'

export interface BusyIndicatorProps {
  /** What is in progress, such as "Loading chain…". */
  label: string
  /** Placement only. */
  className?: string
}

/**
 * Says that work is in progress: a blinking square and a label. It is a polite
 * status region, so a screen reader announces the label when it appears.
 */
export function BusyIndicator({ label, className }: BusyIndicatorProps) {
  return (
    <div role="status" aria-live="polite" className={joinClasses(styles.indicator, className)}>
      <StatusSquare state="busy" />
      <span className="text-label">{label}</span>
    </div>
  )
}
