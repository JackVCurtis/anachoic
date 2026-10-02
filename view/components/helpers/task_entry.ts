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
  /** The id of the worker chosen, or null or absent for "Any worker". */
  assignTo?: string | null
}

/**
 * A live worker a task can be assigned to.
 */
export interface TaskEntryWorker {
  id: string
  name: string
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
  return { title: '', steps: [newTaskEntryStep()], assignTo: null }
}

/**
 * The worker the draft is assigned to, or null for "Any worker". A worker
 * that is no longer live counts as "Any worker".
 */
export function draftAssignee(
  draft: TaskEntryDraft,
  workers: readonly TaskEntryWorker[]
): string | null {
  const chosen = draft.assignTo ?? null
  return workers.some((worker) => worker.id === chosen) ? chosen : null
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
  if (!stepsFilled(draft.steps)) {
    return taskEntry.stepNeedsTitle
  }
  return null
}

/**
 * Whether every step has a title. Spaces alone count as empty.
 */
export function stepsFilled(steps: readonly TaskEntryStep[]): boolean {
  return steps.length > 0 && steps.every((step) => isFilled(step.title))
}

/**
 * The steps as the tools take them: every text trimmed, and a detail left
 * out when it is empty.
 */
export function submittedSteps(steps: readonly TaskEntryStep[]) {
  return steps.map(({ title, owner, detail }) => ({
    title: title.trim(),
    owner,
    ...(isFilled(detail) ? { detail: detail.trim() } : {}),
  }))
}

/**
 * The draft as add_task takes it: every text trimmed, a detail left out when
 * it is empty, and the worker left out for "Any worker" or one no longer live.
 */
export function submittedTask(draft: TaskEntryDraft, workers: readonly TaskEntryWorker[] = []) {
  const assignTo = draftAssignee(draft, workers)
  return {
    title: draft.title.trim(),
    steps: submittedSteps(draft.steps),
    ...(assignTo === null ? {} : { assignTo }),
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
