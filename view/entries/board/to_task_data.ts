import { firstQuestion } from '../../../shared/form'
import type { TaskEvent, TaskProps, TaskRef, TaskStep } from '../../../shared/props'
import {
  TASK_EVENT_KINDS,
  type TaskEventData,
  type TaskEventKind,
  type TaskSummary,
  type TaskViewData,
  type TimelineStepData,
} from '../../components/task/task_data'

function isEventKind(kind: string): kind is TaskEventKind {
  return (TASK_EVENT_KINDS as readonly string[]).includes(kind)
}

/**
 * What a card knows of a task, which the task view's header shows while the
 * task loads.
 */
export function toTaskSummary(task: TaskRef): TaskSummary {
  return {
    id: task.id,
    displayId: task.displayId,
    title: task.title,
    assignedTo: task.assignedTo ?? null,
  }
}

function toTimelineStep(step: TaskStep): TimelineStepData {
  return {
    id: step.id,
    number: step.number,
    owner: step.owner,
    title: step.title,
    status: step.status,
    detail: step.detail,
    sessionName: step.session?.name ?? null,
    question: step.form ? firstQuestion(step.form) : null,
    answer: step.answer,
    blocked: step.blocked,
    note: step.note,
    summary: step.summary,
    links: step.links,
    outputFormat: step.outputFormat,
    artifactUrl: step.artifactUrl,
    input: step.input,
    durationSeconds: step.status === 'done' ? step.elapsedSeconds : null,
    runningSince: step.runningSince,
    elapsedSeconds: step.elapsedSeconds,
    waitingSince: step.waitingSince,
  }
}

/** An event of a kind the view has no word for is left out. */
function toEvent(event: TaskEvent): TaskEventData[] {
  if (!isEventKind(event.kind)) {
    return []
  }
  return [
    {
      id: String(event.id),
      at: event.at,
      kind: event.kind,
      stepNumber: event.stepNumber,
      sessionName: event.by === 'you' ? null : event.by.name,
      detail: event.detail === '' ? null : event.detail,
    },
  ]
}

/**
 * The server's task props in the task view's own terms. A done task has no
 * current step.
 */
export function toTaskData(props: TaskProps): TaskViewData {
  const current =
    props.task.status === 'done' ? undefined : props.steps.find((step) => step.current)
  return {
    task: toTaskSummary(props.task),
    list: props.task.list,
    steps: props.steps.map(toTimelineStep),
    currentStepId: current?.id ?? null,
    events: props.events.flatMap(toEvent),
    agentSeconds: props.agentSeconds,
    yourSeconds: props.yourSeconds,
    canAct: props.canAct,
  }
}
