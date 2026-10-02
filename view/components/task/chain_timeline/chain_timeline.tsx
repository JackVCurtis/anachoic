import { taskView } from '../../helpers/strings'
import { SectionHeader } from '../../patterns/section_header/section_header'
import type { TimelineStepData } from '../task_data'
import { TimelineStep } from '../timeline_step/timeline_step'
import styles from './chain_timeline.module.css'

export interface ChainTimelineProps {
  /** In chain order. */
  steps: readonly TimelineStepData[]
  /** The step the chain is at. Null when the task is done. */
  currentStepId: string | null
  /** The open step. Null when none is. */
  openStepId: string | null
  /**
   * A step's header was pressed. The owner opens that step and closes the
   * open one, or closes it when it was the open one.
   */
  onToggleStep: (stepId: string) => void
  /** Asks the host to open a link recorded on a step. */
  onOpenLink: (url: string) => void
}

/**
 * The chain, top to bottom, as an ordered list of steps on a rail. One step
 * is open at a time, and which one is the owner's to keep.
 */
export function ChainTimeline({
  steps,
  currentStepId,
  openStepId,
  onToggleStep,
  onOpenLink,
}: ChainTimelineProps) {
  return (
    <section className={styles.chain}>
      <SectionHeader
        headingLevel={3}
        size="sm"
        title={taskView.handoffChain}
        note={taskView.expandHint}
        noteType="status"
        className={styles.header}
      />
      <ol className={styles.steps}>
        {steps.map((step) => (
          <TimelineStep
            key={step.id}
            step={step}
            isCurrent={step.id === currentStepId}
            open={step.id === openStepId}
            onToggle={() => onToggleStep(step.id)}
            onOpenLink={onOpenLink}
          />
        ))}
      </ol>
    </section>
  )
}
