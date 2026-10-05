import type { OutputFormat, Owner, StepStatus } from '../types.js'
import { API_SERVER, WEB_CLIENT } from './board.js'
import { before, INSTANTS } from './clock.js'
import { LONG_TEXT } from './long_text.js'

/*
 * The shapes below mirror the task view's own prop types in
 * task/task_data.ts, which fixtures may not import. The stories pass them to
 * the components, so the compiler checks that they still fit.
 */

export type TaskListSample =
  'working' | 'yourTurn' | 'toSignOff' | 'signedOff' | 'queue' | 'backlog'

export interface TimelineStepSample {
  id: string
  number: number
  owner: Owner
  title: string
  status: StepStatus
  detail?: string | null
  sessionName?: string | null
  question?: string | null
  answer?: string | null
  blocked?: { reason: string; since: string } | null
  note?: string | null
  summary?: string | null
  links?: ReadonlyArray<{ label: string; url: string }>
  outputFormat?: OutputFormat | null
  artifactUrl?: string | null
  input?: { stepNumber: number; format: OutputFormat; url: string } | null
  durationSeconds?: number | null
  runningSince?: string | null
  elapsedSeconds?: number | null
  waitingSince?: string | null
}

export type TaskEventKindSample =
  | 'added'
  | 'queued'
  | 'claimed'
  | 'noted'
  | 'asked'
  | 'answered'
  | 'completed'
  | 'parked'
  | 'blocked'
  | 'assigned'

export interface TaskEventSample {
  id: string
  at: string
  kind: TaskEventKindSample
  stepNumber?: number | null
  sessionName: string | null
  detail?: string | null
}

export interface TaskViewSample {
  task: {
    id: string
    displayId: string
    title: string
    assignedTo?: { id: string; name: string } | null
  }
  list: TaskListSample
  steps: readonly TimelineStepSample[]
  currentStepId: string | null
  events: readonly TaskEventSample[]
  agentSeconds: number
  yourSeconds: number
  canAct: { park: boolean; archive: boolean }
}

const PR_URL = 'https://github.com/acme/billing/pull/412'
const TICKET_URL = 'https://linear.app/acme/issue/BIL-88'

function stepId(task: number, number: number): string {
  return `${task}-${number}`
}

/**
 * A step of task `task`, numbered `number`, with what it records.
 */
export function stepOf(
  task: number,
  number: number,
  owner: Owner,
  status: StepStatus,
  title: string,
  extra: Partial<TimelineStepSample> = {}
): TimelineStepSample {
  return { id: stepId(task, number), number, owner, status, title, ...extra }
}

function taskOf(number: number, title: string) {
  return { id: String(number), displayId: `T-${String(number).padStart(3, '0')}`, title }
}

/**
 * The events of a task that ran from yesterday to now, one with a day word.
 */
function eventsOf(task: number): TaskEventSample[] {
  return [
    { id: `${task}-e1`, at: INSTANTS.lastWeek, kind: 'added', sessionName: null },
    { id: `${task}-e2`, at: INSTANTS.earlierThisWeek, kind: 'queued', sessionName: null },
    {
      id: `${task}-e3`,
      at: INSTANTS.yesterday,
      kind: 'claimed',
      stepNumber: 1,
      sessionName: API_SERVER,
    },
    {
      id: `${task}-e4`,
      at: INSTANTS.earlierToday,
      kind: 'completed',
      stepNumber: 1,
      sessionName: API_SERVER,
      detail: 'Opened the pull request',
    },
    {
      id: `${task}-e5`,
      at: before({ minutes: 20 }),
      kind: 'completed',
      stepNumber: 2,
      sessionName: null,
      detail: 'Merged, with one nit',
    },
    {
      id: `${task}-e6`,
      at: before({ minutes: 6, seconds: 12 }),
      kind: 'claimed',
      stepNumber: 3,
      sessionName: API_SERVER,
    },
  ]
}

/**
 * A task on step 3 of 4: an agent step done with a pull request, a user step
 * done that took it as input, an agent step running, and a user step to come.
 */
const RUNNING_TASK = 31
export const RUNNING: TaskViewSample = {
  task: { ...taskOf(RUNNING_TASK, 'Move billing webhooks to the event bus'), assignedTo: null },
  list: 'working',
  steps: [
    stepOf(RUNNING_TASK, 1, 'agent', 'done', 'Draft the bus adapter', {
      sessionName: API_SERVER,
      detail: 'Keep the retry semantics of the Redis consumer.',
      summary: 'Added the adapter behind a flag, with tests for each retry path.',
      links: [{ label: 'CI run', url: 'https://ci.acme.dev/runs/9921' }],
      outputFormat: 'pull_request',
      artifactUrl: PR_URL,
      durationSeconds: 9 * 60,
    }),
    stepOf(RUNNING_TASK, 2, 'you', 'done', 'Review the PR and merge', {
      note: 'Merged, with one nit',
      input: { stepNumber: 1, format: 'pull_request', url: PR_URL },
      durationSeconds: 14 * 60,
    }),
    stepOf(RUNNING_TASK, 3, 'agent', 'running', 'Move the consumers one queue at a time', {
      sessionName: API_SERVER,
      note: 'Moved invoices and refunds; payouts next.',
      outputFormat: 'ticket',
      runningSince: before({ minutes: 5, seconds: 12 }),
      elapsedSeconds: 60,
    }),
    stepOf(RUNNING_TASK, 4, 'you', 'pending', 'Watch the error rate for a day'),
  ],
  currentStepId: stepId(RUNNING_TASK, 3),
  events: eventsOf(RUNNING_TASK),
  agentSeconds: 9 * 60,
  yourSeconds: 14 * 60,
  canAct: { park: true, archive: true },
}

/** The running task, assigned to a worker. */
export const ASSIGNED: TaskViewSample = {
  ...RUNNING,
  task: { ...RUNNING.task, assignedTo: { id: 'session-api', name: API_SERVER } },
}

/**
 * A task whose agent step waits on a question of 250 characters, with the
 * answer the user gave the first time it asked.
 */
const ASKING_TASK = 30
export const ASKING: TaskViewSample = {
  task: taskOf(ASKING_TASK, 'Pick the retry policy for the billing webhooks'),
  list: 'yourTurn',
  steps: [
    stepOf(ASKING_TASK, 1, 'agent', 'waiting', 'Choose the retry policy', {
      sessionName: WEB_CLIENT,
      question: LONG_TEXT.answer.slice(0, 250),
      answer: LONG_TEXT.answer.slice(0, 600),
      waitingSince: before({ minutes: 14 }),
      elapsedSeconds: 8 * 60,
    }),
    stepOf(ASKING_TASK, 2, 'you', 'pending', 'Approve the policy'),
  ],
  currentStepId: stepId(ASKING_TASK, 1),
  events: [],
  agentSeconds: 8 * 60,
  yourSeconds: 0,
  canAct: { park: true, archive: true },
}

/**
 * A task whose agent step its worker blocked.
 */
const BLOCKED_TASK = 12
export const BLOCKED: TaskViewSample = {
  task: taskOf(BLOCKED_TASK, 'Deploy the webhook consumers'),
  list: 'yourTurn',
  steps: [
    stepOf(BLOCKED_TASK, 1, 'agent', 'done', 'Build the image', {
      sessionName: API_SERVER,
      summary: 'Built and pushed the image.',
      durationSeconds: 4 * 60,
    }),
    stepOf(BLOCKED_TASK, 2, 'agent', 'waiting', 'Deploy', {
      sessionName: API_SERVER,
      blocked: {
        reason: 'Needs AWS credentials for the staging account.',
        since: before({ minutes: 14 }),
      },
      waitingSince: before({ minutes: 14 }),
    }),
  ],
  currentStepId: stepId(BLOCKED_TASK, 2),
  events: [],
  agentSeconds: 4 * 60,
  yourSeconds: 0,
  canAct: { park: true, archive: true },
}

/**
 * A user step that waits, with the pull request the step before it produced.
 */
const REVIEW_TASK = 9
export const REVIEW: TaskViewSample = {
  task: taskOf(REVIEW_TASK, 'Fix the flaky login test'),
  list: 'yourTurn',
  steps: [
    stepOf(REVIEW_TASK, 1, 'agent', 'done', 'Find the race', {
      sessionName: API_SERVER,
      summary: 'The session cookie was read before it was set.',
      outputFormat: 'pull_request',
      artifactUrl: PR_URL,
      durationSeconds: 22 * 60,
    }),
    stepOf(REVIEW_TASK, 2, 'you', 'waiting', 'Review the PR and merge', {
      input: { stepNumber: 1, format: 'pull_request', url: PR_URL },
      waitingSince: before({ minutes: 14 }),
    }),
  ],
  currentStepId: stepId(REVIEW_TASK, 2),
  events: [],
  agentSeconds: 22 * 60,
  yourSeconds: 0,
  canAct: { park: true, archive: true },
}

/**
 * A task of 12 steps, on step 5.
 */
const LONG_TASK = 40
export const TWELVE_STEPS: TaskViewSample = {
  task: taskOf(LONG_TASK, 'Split the monolith into twelve services'),
  list: 'working',
  steps: Array.from({ length: 12 }, (_, index) => {
    const number = index + 1
    const owner: Owner = number % 3 === 0 ? 'you' : 'agent'
    const status: StepStatus = number < 5 ? 'done' : number === 5 ? 'running' : 'pending'
    return stepOf(LONG_TASK, number, owner, status, `Carve out service ${number}`, {
      sessionName: owner === 'agent' && number <= 5 ? API_SERVER : null,
      durationSeconds: status === 'done' ? number * 60 : null,
      runningSince: status === 'running' ? before({ minutes: 3 }) : null,
    })
  }),
  currentStepId: stepId(LONG_TASK, 5),
  events: [],
  agentSeconds: 7 * 60,
  yourSeconds: 3 * 60,
  canAct: { park: true, archive: true },
}

/**
 * A finished task, waiting to be signed off.
 */
const DONE_TASK = 6
export const DONE: TaskViewSample = {
  task: taskOf(DONE_TASK, 'Fix flaky login test'),
  list: 'toSignOff',
  steps: [
    stepOf(DONE_TASK, 1, 'agent', 'done', 'Find the race', {
      sessionName: API_SERVER,
      summary: 'Found it in the cookie middleware.',
      durationSeconds: 11 * 60,
    }),
    stepOf(DONE_TASK, 2, 'agent', 'done', 'Fix it', {
      sessionName: API_SERVER,
      summary: 'Fixed and added a regression test.',
      outputFormat: 'pull_request',
      artifactUrl: PR_URL,
      durationSeconds: 3 * 60,
    }),
    stepOf(DONE_TASK, 3, 'you', 'done', 'Merge', { durationSeconds: 6 * 60 }),
  ],
  currentStepId: null,
  events: eventsOf(DONE_TASK),
  agentSeconds: 14 * 60,
  yourSeconds: 6 * 60,
  canAct: { park: false, archive: true },
}

/**
 * A signed-off task, which can be neither parked nor archived from the view.
 */
export const SIGNED_OFF: TaskViewSample = {
  ...DONE,
  list: 'signedOff',
  canAct: { park: false, archive: false },
}

/**
 * A step with ten links.
 */
const LINKS_TASK = 44
export const TEN_LINKS: TaskViewSample = {
  task: taskOf(LINKS_TASK, 'Audit the billing dashboards'),
  list: 'toSignOff',
  steps: [
    stepOf(LINKS_TASK, 1, 'agent', 'done', 'List every dashboard', {
      sessionName: API_SERVER,
      summary: 'Found ten dashboards, linked below.',
      links: Array.from({ length: 10 }, (_, index) => ({
        label: `Dashboard ${index + 1}`,
        url: `https://grafana.acme.dev/d/billing-${index + 1}/billing-overview-with-a-long-address-${index + 1}`,
      })),
      outputFormat: 'ticket',
      artifactUrl: TICKET_URL,
      durationSeconds: 17 * 60,
    }),
  ],
  currentStepId: null,
  events: [],
  agentSeconds: 17 * 60,
  yourSeconds: 0,
  canAct: { park: false, archive: true },
}

/**
 * A task in the backlog, with a long title and a long session name.
 */
const LONG_TEXT_TASK = 45
export const LONG_TITLE: TaskViewSample = {
  task: {
    ...taskOf(LONG_TEXT_TASK, LONG_TEXT.title),
    assignedTo: { id: 'session-long', name: LONG_TEXT.name },
  },
  list: 'backlog',
  steps: [
    stepOf(LONG_TEXT_TASK, 1, 'agent', 'pending', LONG_TEXT.title, { detail: LONG_TEXT.message }),
  ],
  currentStepId: stepId(LONG_TEXT_TASK, 1),
  events: [],
  agentSeconds: 0,
  yourSeconds: 0,
  canAct: { park: false, archive: true },
}

/**
 * One step of each look a step of the chain can take, with whether it is
 * the current step: done, an agent's running, an agent's not yet claimed, an
 * agent's waiting on its question, a user's waiting, a user's not waiting,
 * and one not started.
 */
export const EVERY_APPEARANCE: ReadonlyArray<{ step: TimelineStepSample; isCurrent: boolean }> = [
  { step: RUNNING.steps[0], isCurrent: false },
  { step: RUNNING.steps[2], isCurrent: true },
  {
    step: stepOf(50, 1, 'agent', 'pending', 'Draft the migration', {
      detail: 'Use the new schema.',
    }),
    isCurrent: true,
  },
  { step: ASKING.steps[0], isCurrent: true },
  { step: REVIEW.steps[1], isCurrent: true },
  { step: stepOf(51, 1, 'you', 'pending', 'Decide on the rollout'), isCurrent: true },
  { step: RUNNING.steps[3], isCurrent: false },
]

/**
 * The events of a task, some of them with a day word.
 */
export const EVENTS: readonly TaskEventSample[] = eventsOf(RUNNING_TASK)

export const TASKS = {
  RUNNING,
  ASSIGNED,
  ASKING,
  BLOCKED,
  REVIEW,
  TWELVE_STEPS,
  DONE,
  SIGNED_OFF,
  TEN_LINKS,
  LONG_TITLE,
} as const
