import { done, taskEntry } from './strings'
import { newTaskEntryStep, stepsFilled, submittedSteps, type TaskEntryStep } from './task_entry'

/**
 * Where a follow-up puts its task in the Queue: `last` is "Back" and `first`
 * is "Front".
 */
export type Placement = 'first' | 'last'

/** The two choices of the placement field, in the order they are shown. */
export const PLACEMENT_OPTIONS: ReadonlyArray<{ placement: Placement; label: string }> = [
  { placement: 'last', label: done.placementLast },
  { placement: 'first', label: done.placementFirst },
]

export interface FollowUpDraft {
  steps: readonly TaskEntryStep[]
  placement: Placement
}

/**
 * What a composer opens with: one empty step an agent owns, placed at the
 * back. The front is chosen each time, never remembered.
 */
export function emptyFollowUpDraft(): FollowUpDraft {
  return { steps: [newTaskEntryStep()], placement: 'last' }
}

/**
 * The note beside "Append & queue": what is missing, or what appending does.
 */
export function followUpNote(draft: FollowUpDraft): string {
  return canAppendFollowUp(draft) ? done.followUpReady : taskEntry.stepNeedsTitle
}

/**
 * Whether the draft can be appended. The placement plays no part.
 */
export function canAppendFollowUp(draft: FollowUpDraft): boolean {
  return stepsFilled(draft.steps)
}

/**
 * The draft as add_follow_up takes it.
 */
export function submittedFollowUp(draft: FollowUpDraft) {
  return { steps: submittedSteps(draft.steps), placement: draft.placement }
}

export type FollowUpInput = ReturnType<typeof submittedFollowUp>
