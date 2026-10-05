import type { Owner, OutputFormat } from '../types'
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
  /** What an agent step hands on when it is done. Absent or null for none, and on user steps. */
  outputFormat?: OutputFormat | null
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
 * A task to clone, as far as a draft needs it.
 */
export interface ClonedTask {
  title: string
  assignedTo?: { id: string } | null
  steps: ReadonlyArray<{
    title: string
    owner: Owner
    detail?: string | null
    outputFormat?: OutputFormat | null
  }>
}

/**
 * A draft holding a copy of the task: its title, its worker, and every step
 * of its chain, follow-ups included, held to the entry's limits.
 */
export function clonedDraft(task: ClonedTask): TaskEntryDraft {
  return {
    title: task.title.slice(0, TASK_ENTRY_LIMITS.title),
    assignTo: task.assignedTo?.id ?? null,
    steps: task.steps.slice(0, TASK_ENTRY_LIMITS.steps).map((step) => ({
      ...newTaskEntryStep(step.owner),
      title: step.title.slice(0, TASK_ENTRY_LIMITS.title),
      detail: (step.detail ?? '').slice(0, TASK_ENTRY_LIMITS.detail),
      outputFormat: step.owner === 'agent' ? (step.outputFormat ?? null) : null,
    })),
  }
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
 * The steps as the tools take them: every text trimmed, a detail left out
 * when it is empty, and an output format only on an agent step that has one.
 */
export function submittedSteps(steps: readonly TaskEntryStep[]) {
  return steps.map(({ title, owner, detail, outputFormat }) => ({
    title: title.trim(),
    owner,
    ...(isFilled(detail) ? { detail: detail.trim() } : {}),
    ...(owner === 'agent' && outputFormat ? { outputFormat } : {}),
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
