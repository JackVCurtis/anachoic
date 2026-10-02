import type { Owner } from '../types'
import { taskEntry } from './strings'

/**
 * The limits task entry holds its fields to, the same as the server's
 * (shared/limits.ts, which components may not import).
 */
export const TASK_ENTRY_LIMITS = {
  title: 200,
  detail: 4000,
  steps: 20,
} as const

/**
 * One step of a task being written. The id only keys the step while it is
 * written; the server mints the step's own.
 */
export interface TaskEntryStep {
  id: string
  title: string
  owner: Owner
  detail: string
}

export interface TaskEntryDraft {
  title: string
  steps: readonly TaskEntryStep[]
}

let stepKeys = 0

/**
 * A step with no title, owned by an agent.
 */
export function newTaskEntryStep(owner: Owner = 'agent'): TaskEntryStep {
  stepKeys += 1
  return { id: `step-${stepKeys}`, title: '', owner, detail: '' }
}

/**
 * A task with no title and one empty step, which an agent owns.
 */
export function emptyTaskEntryDraft(): TaskEntryDraft {
  return { title: '', steps: [newTaskEntryStep()] }
}

function isFilled(text: string): boolean {
  return text.trim() !== ''
}

/**
 * What the draft still needs before it can be added, or null when it can be.
 * Spaces alone count as empty.
 */
export function taskEntryMissing(draft: TaskEntryDraft): string | null {
  if (!isFilled(draft.title)) {
    return taskEntry.needsTitle
  }
  if (draft.steps.length === 0 || draft.steps.some((step) => !isFilled(step.title))) {
    return taskEntry.stepNeedsTitle
  }
  return null
}

/**
 * The draft as add_task takes it: every text trimmed, and a detail left out
 * when it is empty.
 */
export function submittedTask(draft: TaskEntryDraft) {
  return {
    title: draft.title.trim(),
    steps: draft.steps.map(({ title, owner, detail }) => ({
      title: title.trim(),
      owner,
      ...(isFilled(detail) ? { detail: detail.trim() } : {}),
    })),
  }
}

/**
 * The field a message from the server is about: the task title, the list of
 * steps, or one step's title or detail, counted from 0.
 */
export type TaskEntryField =
  | { kind: 'title' }
  | { kind: 'steps' }
  | { kind: 'step-title'; index: number }
  | { kind: 'step-detail'; index: number }

export interface TaskEntryFieldError {
  field: TaskEntryField
  /** The server's sentence, shown as given. */
  text: string
}
