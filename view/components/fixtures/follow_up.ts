import type { FollowUpDraft } from '../helpers/follow_up'
import type { TaskEntryStep } from '../helpers/task_entry'

function step(index: number, title: string, owner: TaskEntryStep['owner']): TaskEntryStep {
  return { id: `follow-up-step-${index}`, title, owner, detail: '' }
}

const THREE_STEPS = [
  step(1, 'Find the second flake', 'agent'),
  step(2, 'Fix it', 'agent'),
  step(3, 'Check the nightly run', 'you'),
]

/**
 * Drafts of a follow-up, one per state its stories show.
 */
export const FOLLOW_UP_DRAFTS = {
  empty: { steps: [step(1, '', 'agent')], placement: 'last' },
  threeSteps: { steps: THREE_STEPS, placement: 'last' },
  front: { steps: THREE_STEPS, placement: 'first' },
} as const satisfies Record<string, FollowUpDraft>
