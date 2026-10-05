import { currentStep } from '../../domain/chain.js'
import { inputOf } from '../../domain/derived.js'
import type { Event, Owner, SessionKind, Step, TaskState } from '../../domain/types.js'
import { OUTPUT_FORMAT_WORDS } from '../../shared/output_format.js'
import { formatTaskId } from '../../shared/task_id.js'
import { since } from './board_summary.js'

/**
 * The text result of each model tool that changes the board: one compact
 * block for the model, in the sentences of 06's tables. The texts never
 * address the user in the second person: "you" is always the model.
 */

/**
 * A step's owner as the model reads it.
 */
export function ownerWord(owner: Owner): 'agent' | 'user' {
  return owner === 'you' ? 'user' : 'agent'
}

function steps(count: number, adjective = '') {
  const noun = count === 1 ? 'step' : 'steps'
  return adjective ? `${count} ${adjective} ${noun}` : `${count} ${noun}`
}

/**
 * Where a task stands after a change that started it at once, because its
 * current step is the user's.
 */
function waitsOnUser({ task, steps: chain }: TaskState) {
  const step = currentStep(chain)
  return `${formatTaskId(task.id)} is active: step ${step.number} "${step.title}" waits on the user`
}

/**
 * `assignedName` is the worker the task was assigned to, if any.
 */
export function addTaskText(state: TaskState, assignedName?: string): string {
  const id = formatTaskId(state.task.id)
  const assigned = assignedName ? `. It is assigned to ${assignedName}` : ''
  switch (state.task.status) {
    case 'queue':
      return `Added ${id} to the queue at position ${state.task.queuePosition}${assigned}`
    case 'active':
      return `Added ${id}${assigned}. ${waitsOnUser(state)}`
    default:
      return `Added ${id} to the backlog${assigned}`
  }
}

export function queueTaskText(state: TaskState): string {
  return state.task.status === 'active'
    ? waitsOnUser(state)
    : `${formatTaskId(state.task.id)} is in the queue at position ${state.task.queuePosition}`
}

export function addFollowUpText(state: TaskState, added: number): string {
  const id = formatTaskId(state.task.id)
  const count = steps(added, 'new')
  return state.task.status === 'active'
    ? `${waitsOnUser(state)}, with ${count}`
    : `${id} is back in the queue at position ${state.task.queuePosition} with ${count}`
}

/**
 * Each step's past blocks, by step id: "blocked 14m: needs AWS credentials".
 * A block ends with the step's next unblocked, released, parked or archived
 * event; one still open is counted to `now`.
 */
export function blockHistory(events: readonly Event[], now: string): Map<string, string[]> {
  const ends = new Set(['unblocked', 'released', 'parked', 'archived', 'completed'])
  const history = new Map<string, string[]>()
  const open = new Map<string, Event>()
  const close = (stepId: string, at: string) => {
    const started = open.get(stepId)
    if (!started) return
    open.delete(stepId)
    const lines = history.get(stepId) ?? []
    lines.push(`blocked ${since(started.at, at)}: ${started.detail}`)
    history.set(stepId, lines)
  }
  for (const event of events) {
    if (event.kind === 'blocked' && event.stepId !== null) open.set(event.stepId, event)
    else if (ends.has(event.kind)) {
      if (event.stepId !== null) close(event.stepId, event.at)
      else for (const stepId of [...open.keys()]) close(stepId, event.at)
    }
  }
  for (const stepId of [...open.keys()]) close(stepId, now)
  return history
}

function chainLine(step: Step, blocks?: ReadonlyMap<string, string[]>) {
  const head = `${step.number}. "${step.title}" (${ownerWord(step.owner)})`
  const line = step.summary ? `${head}: ${step.summary}` : head
  const past = blocks?.get(step.id)
  return past ? `${line} (${past.join('; ')})` : line
}

/**
 * One line for each step before `before` that has an artifact:
 * "Step 2 (agent): Pull request https://…".
 */
export function artifactLines(chain: readonly Step[], before: number): string[] {
  return chain.flatMap((step) =>
    step.number < before && step.outputFormat !== null && step.artifactUrl !== null
      ? [
          `Step ${step.number} (${ownerWord(step.owner)}): ${OUTPUT_FORMAT_WORDS[step.outputFormat].shown} ${step.artifactUrl}`,
        ]
      : []
  )
}

/**
 * The claimed step in full: its input, the previous step's artifact, first;
 * the user's note when they rejected the last attempt; what to do and what it must produce; whether the task is assigned to the
 * caller; the chain so far with each completed step's summary, past blocks
 * and artifacts; the steps after it; and what to call next.
 */
export function claimStepText(
  state: TaskState,
  callerId?: string,
  blocks?: ReadonlyMap<string, string[]>
): string {
  const id = formatTaskId(state.task.id)
  const step = currentStep(state.steps)
  const done = state.steps.filter((each) => each.number < step.number)
  const later = state.steps.filter((each) => each.number > step.number)
  const artifacts = artifactLines(state.steps, step.number)
  const input = inputOf(state.steps, step)
  return [
    `Claimed ${id} step ${step.number} of ${state.steps.length}: "${step.title}"`,
    ...(input
      ? [
          `Input from step ${input.stepNumber}: ${OUTPUT_FORMAT_WORDS[input.format].shown} ${input.url}`,
        ]
      : []),
    ...(step.rejection
      ? [
          `The user rejected the last attempt: ${step.rejection}`,
          ...(step.summary ? [`Last attempt: ${step.summary}`] : []),
        ]
      : []),
    `Task: "${state.task.title}"`,
    ...(callerId !== undefined && state.task.assignedTo === callerId
      ? [`${id} is assigned to you: no other session may claim its agent steps.`]
      : []),
    ...(step.detail ? [`Detail: ${step.detail}`] : []),
    ...(step.outputFormat
      ? [
          `Produces: ${OUTPUT_FORMAT_WORDS[step.outputFormat].produced}. Finish with complete_step and artifact_url.`,
        ]
      : []),
    ...(blocks?.get(step.id)
      ? [`Before this claim, the step was ${blocks.get(step.id)!.join('; ')}`]
      : []),
    ...(done.length === 0
      ? ['Done so far: none']
      : ['Done so far:', ...done.map((each) => chainLine(each, blocks))]),
    ...(artifacts.length === 0 ? [] : ['Artifacts:', ...artifacts]),
    ...(later.length === 0 ? [] : ['After this step:', ...later.map((each) => chainLine(each))]),
    `Next: do the step. Call update_step with task ${id} to note progress, ask_you if you need an answer from the user, and complete_step with task ${id}, a summary and links when it is done.`,
  ].join('\n')
}

export function updateStepText(state: TaskState): string {
  return `Noted on ${formatTaskId(state.task.id)} step ${currentStep(state.steps).number}`
}

export function blockStepText(state: TaskState): string {
  return `Blocked. The user will unblock this in this session. End this turn now and wait for the user here; when they have resolved it, call unblock_step with task ${formatTaskId(state.task.id)}.`
}

export function unblockStepText(state: TaskState): string {
  return `Unblocked. Carry on with step ${currentStep(state.steps).number} of ${formatTaskId(state.task.id)}.`
}

export function askYouText(state: TaskState): string {
  return `Asked. Call wait_for_answer with task ${formatTaskId(state.task.id)} next.`
}

/**
 * What happened after the step was completed: the task is done, waits on
 * the user, or is back in the queue for an agent to continue. A worker that
 * hands a step to the user is told to wait for the task to come back.
 */
export function completeStepText(
  state: TaskState,
  events: readonly Event[],
  kind: SessionKind = 'worker'
): string {
  const id = formatTaskId(state.task.id)
  const completed = events.find((event) => event.kind === 'completed')
  const number = state.steps.find((step) => step.id === completed?.stepId)?.number
  const head = `Completed ${id} step ${number}.`
  switch (state.task.status) {
    case 'done':
      return `${head} ${id} is done.`
    case 'queue':
      return `${head} ${id} is back in the queue at position ${state.task.queuePosition}. Call claim_step with task ${id} to continue it.`
    default: {
      const next = currentStep(state.steps)
      return kind === 'dedicated'
        ? `${head} Step ${next.number} "${next.title}" waits on the user.`
        : `${head} Step ${next.number} of ${id} is the user's. Call wait_for_work to be told when this task needs an agent again.`
    }
  }
}
