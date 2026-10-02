import { currentStep } from '../../domain/chain.js'
import type { Event, SessionKind, Step, TaskState } from '../../domain/types.js'
import { OUTPUT_FORMAT_WORDS } from '../../shared/output_format.js'
import { formatTaskId } from '../../shared/task_id.js'

/**
 * The text result of each model tool that changes the board: one compact
 * block for the model, in the sentences of 06's tables.
 */

function steps(count: number, adjective = '') {
  const noun = count === 1 ? 'step' : 'steps'
  return adjective ? `${count} ${adjective} ${noun}` : `${count} ${noun}`
}

/**
 * Where a task stands after a change that sent it to the queue, the backlog,
 * or straight to you.
 */
function waitsOnYou({ task, steps: chain }: TaskState) {
  const step = currentStep(chain)
  return `${formatTaskId(task.id)} is active: step ${step.number} "${step.title}" waits on you`
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
      return `Added ${id}${assigned}. ${waitsOnYou(state)}`
    default:
      return `Added ${id} to the backlog${assigned}`
  }
}

export function queueTaskText(state: TaskState): string {
  return state.task.status === 'active'
    ? waitsOnYou(state)
    : `${formatTaskId(state.task.id)} is in the queue at position ${state.task.queuePosition}`
}

export function addFollowUpText(state: TaskState, added: number): string {
  const id = formatTaskId(state.task.id)
  const count = steps(added, 'new')
  return state.task.status === 'active'
    ? `${waitsOnYou(state)}, with ${count}`
    : `${id} is back in the queue at position ${state.task.queuePosition} with ${count}`
}

function chainLine(step: Step) {
  const head = `${step.number}. "${step.title}" (${step.owner === 'you' ? 'yours' : 'agent'})`
  return step.summary ? `${head}: ${step.summary}` : head
}

/**
 * One line for each step before `before` that has an artifact:
 * "Step 2 (you): Pull request https://…".
 */
export function artifactLines(chain: readonly Step[], before: number): string[] {
  return chain.flatMap((step) =>
    step.number < before && step.outputFormat !== null && step.artifactUrl !== null
      ? [
          `Step ${step.number} (${step.owner}): ${OUTPUT_FORMAT_WORDS[step.outputFormat].shown} ${step.artifactUrl}`,
        ]
      : []
  )
}

/**
 * The claimed step in full: what to do, whether the task is assigned to the
 * caller, the chain so far with each completed step's summary, the steps
 * after it, and what to call next.
 */
export function claimStepText(state: TaskState, callerId?: string): string {
  const id = formatTaskId(state.task.id)
  const step = currentStep(state.steps)
  const done = state.steps.filter((each) => each.number < step.number)
  const later = state.steps.filter((each) => each.number > step.number)
  const artifacts = artifactLines(state.steps, step.number)
  return [
    `Claimed ${id} step ${step.number} of ${state.steps.length}: "${step.title}"`,
    `Task: "${state.task.title}"`,
    ...(callerId !== undefined && state.task.assignedTo === callerId
      ? [`${id} is assigned to you: no other session may claim its agent steps.`]
      : []),
    ...(step.detail ? [`Detail: ${step.detail}`] : []),
    ...(done.length === 0 ? ['Done so far: none'] : ['Done so far:', ...done.map(chainLine)]),
    ...(artifacts.length === 0 ? [] : ['Artifacts:', ...artifacts]),
    ...(later.length === 0 ? [] : ['After this step:', ...later.map(chainLine)]),
    `Next: do the step. Call update_step with task ${id} to note progress, ask_you if you need an answer from the person, and complete_step with task ${id}, a summary and links when it is done.`,
  ].join('\n')
}

export function updateStepText(state: TaskState): string {
  return `Noted on ${formatTaskId(state.task.id)} step ${currentStep(state.steps).number}`
}

export function askYouText(state: TaskState, kind: SessionKind): string {
  return kind === 'dedicated'
    ? 'Asked. Your answer will arrive as a message from the board.'
    : `Asked. Call wait_for_answer with task ${formatTaskId(state.task.id)} next.`
}

/**
 * What happened after the step was completed: the task is done, waits on
 * you, or is back in the queue for an agent to continue.
 */
export function completeStepText(state: TaskState, events: readonly Event[]): string {
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
      return `${head} Step ${next.number} "${next.title}" waits on you.`
    }
  }
}
