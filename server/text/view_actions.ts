import { currentStep } from '../../domain/chain.js'
import type { Event, TaskState } from '../../domain/types.js'
import { formatTaskId } from '../../shared/task_id.js'
import { addFollowUpText, addTaskText, queueTaskText } from './model_tools.js'

/**
 * The one-line confirmation each app-only tool returns as its text beside
 * the board props. The view draws from the props; the line is for the log.
 */

function stepOf(state: TaskState, events: readonly Event[], kind: Event['kind']) {
  const stepId = events.find((event) => event.kind === kind)?.stepId
  return state.steps.find((step) => step.id === stepId)?.number
}

export const viewActionText = {
  addTask: (state: TaskState) => addTaskText(state),
  queueTask: (state: TaskState) => queueTaskText(state),
  reorderQueue: (state: TaskState) =>
    `${formatTaskId(state.task.id)} is in the queue at position ${state.task.queuePosition}`,
  moveToBacklog: (state: TaskState, events: readonly Event[]) =>
    events.some((event) => event.kind === 'parked' && event.stepId !== null)
      ? `Parked ${formatTaskId(state.task.id)} in the backlog`
      : `Moved ${formatTaskId(state.task.id)} to the backlog`,
  completeMyStep: (state: TaskState, events: readonly Event[]) =>
    `Marked ${formatTaskId(state.task.id)} step ${stepOf(state, events, 'completed')} done`,
  answerQuestion: (state: TaskState) =>
    `Answered ${formatTaskId(state.task.id)} step ${currentStep(state.steps).number}`,
  signOff: (state: TaskState) => `Signed off ${formatTaskId(state.task.id)}`,
  addFollowUp: (state: TaskState, added: number) => addFollowUpText(state, added),
  archiveTask: (state: TaskState) => `Archived ${formatTaskId(state.task.id)}`,
  rejectStep: (state: TaskState, events: readonly Event[], resumeName?: string) =>
    `Rejected step ${stepOf(state, events, 'rejected')} of ${formatTaskId(state.task.id)}. It is back in the queue at position ${state.task.queuePosition}${resumeName ? ` for ${resumeName}` : ''}.`,
}
