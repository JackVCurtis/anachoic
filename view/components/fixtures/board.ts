// Adapted from anachoic inertia/components/fixtures/tasks.ts, task_lists.ts and slots.ts at fd99e0d
import type { OutputFormat, Owner, StepStatus } from '../types.js'
import { before, INSTANTS } from './clock.js'
import { LONG_TEXT } from './long_text.js'
import type { PipStepSample } from './pip_steps.js'

/*
 * The shapes below mirror the board view's own prop types in
 * board/board_data.ts, which fixtures may not import. The fixtures test
 * checks that every board is assignable to them.
 */

export interface WorkerSample {
  id: string
  name: string
}

export interface ArtifactSample {
  stepNumber: number
  format: OutputFormat
  url: string
}

export interface TaskSample {
  id: string
  displayId: string
  title: string
  assignedTo?: WorkerSample | null
}

export interface YourTurnSample {
  task: TaskSample
  step: {
    number: number
    title: string
    owner: Owner
    question?: string
    waitingSince: string
  }
  input?: ArtifactSample | null
  sessionName?: string
  blocked?: { reason: string; since: string }
  steps: readonly PipStepSample[]
  canAct: { complete?: boolean; answer?: boolean; park: boolean }
}

export interface WorkingSample {
  task: TaskSample
  step: {
    number: number
    title: string
    note?: string
    outputFormat?: OutputFormat
    runningSince: string
  }
  sessionName: string
  steps: readonly PipStepSample[]
  artifacts?: ArtifactSample[]
}

export interface QueueSample {
  task: TaskSample
  position: number
  nextOwner: Owner
  steps: readonly PipStepSample[]
  artifacts?: ArtifactSample[]
  canAct: { reorder: boolean; backlog: boolean }
}

export interface BacklogSample {
  task: TaskSample
  steps: readonly PipStepSample[]
  artifacts?: ArtifactSample[]
  canAct: { queue: boolean; archive: boolean }
}

export interface SignOffSample {
  task: TaskSample
  finishedAt: string
  agentSeconds: number
  yourSeconds: number
  linkCount: number
  steps: readonly PipStepSample[]
  artifacts?: ArtifactSample[]
  canAct: { signOff: boolean; followUp: boolean; archive: boolean }
}

export interface SignedOffSample {
  task: TaskSample
  signedOffAt: string
}

export interface SessionSample {
  id: string
  kind: 'dedicated' | 'worker'
  name: string
  live: boolean
  holding?: {
    task: TaskSample
    step: { number: number; title: string }
    status: 'running' | 'waiting' | 'blocked'
  }
  endedAt?: string
  released?: readonly TaskSample[]
}

export interface BoardSample {
  yourTurn: readonly YourTurnSample[]
  working: readonly WorkingSample[]
  queue: readonly QueueSample[]
  backlog: readonly BacklogSample[]
  toSignOff: readonly SignOffSample[]
  signedOff: readonly SignedOffSample[]
  sessions: readonly SessionSample[]
  counts: { yourTurn: number; working: number; queue: number; toSignOff: number }
  updatedAt: string | null
  unreachable: boolean
}

/**
 * One step of a chain: who does it, where it stands, its title, and the
 * session that holds it while it is running or waiting.
 */
export type StepSpec = readonly [
  owner: Owner,
  status: StepStatus,
  title: string,
  sessionName?: string,
]

export function taskOf(number: number, title: string): TaskSample {
  return { id: String(number), displayId: `T-${String(number).padStart(3, '0')}`, title }
}

export function chainOf(task: TaskSample, specs: readonly StepSpec[]): PipStepSample[] {
  return specs.map(([owner, status, title, sessionName], index) => ({
    id: `${task.id}.${index + 1}`,
    owner,
    status,
    title,
    sessionName: sessionName ?? null,
  }))
}

/**
 * The first step that is not done, else the last, with its number.
 */
function currentOf(steps: readonly PipStepSample[]) {
  const index = steps.findIndex((step) => step.status !== 'done')
  const at = index === -1 ? steps.length - 1 : index
  return { number: at + 1, step: steps[at] }
}

export function yourStep(
  number: number,
  title: string,
  specs: readonly StepSpec[],
  waitingSince: string
): YourTurnSample {
  const task = taskOf(number, title)
  const steps = chainOf(task, specs)
  const current = currentOf(steps)
  return {
    task,
    step: { number: current.number, title: current.step.title, owner: 'you', waitingSince },
    steps,
    canAct: { complete: true, park: true },
  }
}

export function agentAsks(
  number: number,
  title: string,
  specs: readonly StepSpec[],
  question: string,
  waitingSince: string
): YourTurnSample {
  const task = taskOf(number, title)
  const steps = chainOf(task, specs)
  const current = currentOf(steps)
  return {
    task,
    step: {
      number: current.number,
      title: current.step.title,
      owner: 'agent',
      question,
      waitingSince,
    },
    sessionName: current.step.sessionName ?? undefined,
    steps,
    canAct: { complete: false, answer: true, park: true },
  }
}

/**
 * An agent step its worker blocked, waiting since it was blocked. The server
 * may still allow Park on it; the card offers nothing.
 */
export function workerBlocks(
  number: number,
  title: string,
  specs: readonly StepSpec[],
  reason: string,
  since: string
): YourTurnSample {
  const task = taskOf(number, title)
  const steps = chainOf(task, specs)
  const current = currentOf(steps)
  return {
    task,
    step: {
      number: current.number,
      title: current.step.title,
      owner: 'agent',
      waitingSince: since,
    },
    sessionName: current.step.sessionName ?? undefined,
    blocked: { reason, since },
    steps,
    canAct: { complete: false, answer: false, park: true },
  }
}

export function running(
  number: number,
  title: string,
  specs: readonly StepSpec[],
  runningSince: string,
  note?: string
): WorkingSample {
  const task = taskOf(number, title)
  const steps = chainOf(task, specs)
  const current = currentOf(steps)
  if (current.step.sessionName === null) {
    throw new Error(`${task.displayId}'s running step names no session`)
  }
  return {
    task,
    step: { number: current.number, title: current.step.title, note, runningSince },
    sessionName: current.step.sessionName,
    steps,
  }
}

export function queued(
  position: number,
  number: number,
  title: string,
  specs: readonly StepSpec[]
): QueueSample {
  const task = taskOf(number, title)
  const steps = chainOf(task, specs)
  return {
    task,
    position,
    nextOwner: currentOf(steps).step.owner,
    steps,
    canAct: { reorder: true, backlog: true },
  }
}

export function parked(number: number, title: string, specs: readonly StepSpec[]): BacklogSample {
  const task = taskOf(number, title)
  return { task, steps: chainOf(task, specs), canAct: { queue: true, archive: true } }
}

export function finished(
  number: number,
  title: string,
  specs: readonly StepSpec[],
  times: { finishedAt: string; agentSeconds: number; yourSeconds: number; linkCount: number }
): SignOffSample {
  const task = taskOf(number, title)
  return {
    task,
    ...times,
    steps: chainOf(task, specs),
    canAct: { signOff: true, followUp: true, archive: true },
  }
}

/**
 * The item with its task assigned to the worker.
 */
export function assigned<Item extends { task: TaskSample }>(
  item: Item,
  worker: WorkerSample
): Item {
  return { ...item, task: { ...item.task, assignedTo: worker } }
}

/**
 * The item with the links its done steps produced.
 */
export function withArtifacts<Item extends { artifacts?: ArtifactSample[] }>(
  item: Item,
  artifacts: ArtifactSample[]
): Item & { artifacts: ArtifactSample[] } {
  return { ...item, artifacts }
}

/**
 * A waiting user step, handed the artifact the step before it produced.
 */
export function withInput(item: YourTurnSample, input: ArtifactSample): YourTurnSample {
  return { ...item, input }
}

/**
 * A running agent step that declares the output format it must produce.
 */
export function producing(item: WorkingSample, outputFormat: OutputFormat): WorkingSample {
  return { ...item, step: { ...item.step, outputFormat } }
}

/**
 * The live workers of a board's sessions, which a task can be assigned to.
 */
export function workersOf(board: Pick<BoardSample, 'sessions'>): WorkerSample[] {
  return board.sessions
    .filter((session) => session.kind === 'worker' && session.live)
    .map(({ id, name }) => ({ id, name }))
}

/**
 * The step a session holds, naming its task by id, display id and title only.
 */
export function holdingOf(
  item: YourTurnSample | WorkingSample,
  status: 'running' | 'waiting' | 'blocked'
) {
  const { id, displayId, title } = item.task
  return {
    task: { id, displayId, title },
    step: { number: item.step.number, title: item.step.title },
    status,
  }
}

export function countsOf(board: Pick<BoardSample, 'yourTurn' | 'working' | 'queue' | 'toSignOff'>) {
  return {
    yourTurn: board.yourTurn.length,
    working: board.working.length,
    queue: board.queue.length,
    toSignOff: board.toSignOff.length,
  }
}

export const THIS_CHAT = 'This chat'
export const API_SERVER = 'api-server'
export const WEB_CLIENT = 'web-client'
export const DOCS = 'docs'

const API_SERVER_WORKER: WorkerSample = { id: 'worker-api-server', name: API_SERVER }
const WEB_CLIENT_WORKER: WorkerSample = { id: 'worker-web-client', name: WEB_CLIENT }

/**
 * Nothing waiting, nothing running, nothing queued and no session yet.
 */
export const EMPTY_BOARD: BoardSample = {
  yourTurn: [],
  working: [],
  queue: [],
  backlog: [],
  toSignOff: [],
  signedOff: [],
  sessions: [],
  counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
  updatedAt: null,
  unreachable: false,
}

/*
 * The busy board of 06's text result. This chat holds the step where it asked
 * you a question, and api-server the step it is running.
 */

const REVIEW_THE_PR = yourStep(
  9,
  'Split the settings page into tabs',
  [
    ['agent', 'done', 'Draft the tab layout'],
    ['agent', 'done', 'Move each settings group into its tab'],
    ['you', 'waiting', 'Review the PR'],
    ['agent', 'pending', 'Merge and watch the build'],
  ],
  before({ minutes: 14 })
)

const CHOOSE_THE_CACHE_KEY = agentAsks(
  12,
  'Cache the slow search endpoint',
  [
    ['agent', 'done', 'Profile the slow endpoint'],
    ['agent', 'waiting', 'Choose the cache key', THIS_CHAT],
    ['you', 'pending', 'Check the numbers on staging'],
  ],
  'Redis or in-process?',
  before({ minutes: 6 })
)

const DRAFT_THE_MIGRATION = assigned(
  running(
    14,
    'Add a sessions table',
    [
      ['agent', 'running', 'Draft the migration', API_SERVER],
      ['you', 'pending', 'Review the migration'],
      ['agent', 'pending', 'Run it on staging'],
    ],
    before({ minutes: 12 }),
    'The up migration is written. Writing the down migration now.'
  ),
  API_SERVER_WORKER
)

/** Released by docs when it ended, so it went back to the front of the queue. */
const SETUP_GUIDE = queued(1, 13, 'Write the setup guide', [
  ['agent', 'done', 'Outline the setup guide'],
  ['agent', 'pending', 'Write the troubleshooting section'],
  ['you', 'pending', 'Read the guide through'],
])

const BUSY_QUEUE: readonly QueueSample[] = [
  SETUP_GUIDE,
  assigned(
    queued(2, 15, 'Add retries to the billing webhooks', [
      ['agent', 'pending', 'Add retries with backoff'],
      ['you', 'pending', 'Review the PR'],
    ]),
    WEB_CLIENT_WORKER
  ),
  queued(3, 19, 'Upgrade the queue client', [
    ['you', 'done', 'Choose the version to move to'],
    ['agent', 'pending', 'Upgrade the client and fix the call sites'],
    ['agent', 'pending', 'Run the load test'],
    ['you', 'pending', 'Read the load test results'],
  ]),
  queued(4, 20, 'Bump the SDK to the latest minor', [['agent', 'pending', 'Bump the SDK']]),
]

const BUSY_BACKLOG: readonly BacklogSample[] = [
  parked(3, 'Rename the billing tables', [
    ['agent', 'pending', 'Write the rename migration'],
    ['you', 'pending', 'Review the migration'],
  ]),
  parked(4, 'Decide on a feature flag service', [
    ['you', 'pending', 'List what the flags must do'],
    ['agent', 'pending', 'Compare three services against the list'],
  ]),
  parked(7, 'Remove the old onboarding flow', [
    ['agent', 'done', 'Find every link to the old flow'],
    ['agent', 'pending', 'Delete the old flow'],
  ]),
  parked(8, 'Write the incident review for the outage', [['you', 'pending', 'Write the timeline']]),
  assigned(
    parked(10, 'Add dark mode to the admin pages', [
      ['agent', 'pending', 'Add the dark tokens'],
      ['agent', 'pending', 'Switch the admin pages to the tokens'],
      ['you', 'pending', 'Check every admin page in dark mode'],
    ]),
    WEB_CLIENT_WORKER
  ),
  parked(11, 'Tidy the logging config', [['agent', 'pending', 'Tidy the logging config']]),
]

const FLAKY_LOGIN_TEST = finished(
  6,
  'Fix flaky login test',
  [
    ['agent', 'done', 'Find why the login test fails one run in ten'],
    ['agent', 'done', 'Fix the race in the session fixture'],
    ['you', 'done', 'Review the PR'],
  ],
  { finishedAt: INSTANTS.earlierToday, agentSeconds: 2_520, yourSeconds: 540, linkCount: 2 }
)

const SIGNED_OFF_TITLES: readonly (readonly [number, string])[] = [
  [24, 'Add a health check endpoint'],
  [23, 'Move the cron jobs to the scheduler'],
  [22, 'Fix the timezone in the weekly report'],
  [21, 'Add an index to the events table'],
  [18, 'Write the API changelog for March'],
  [17, 'Drop the unused feature flags'],
  [16, 'Fix the broken link in the footer'],
  [5, 'Add pagination to the audit log'],
  [2, 'Set up the staging database'],
  [1, 'Add the board to the README'],
]

/** Most recent first, an hour apart from yesterday afternoon back. */
const BUSY_SIGNED_OFF: readonly SignedOffSample[] = SIGNED_OFF_TITLES.map(
  ([number, title], index) => ({
    task: taskOf(number, title),
    signedOffAt: index === 0 ? INSTANTS.yesterday : before({ days: 1, hours: 2 + index * 3 }),
  })
)

const BUSY_LISTS = {
  yourTurn: [REVIEW_THE_PR, CHOOSE_THE_CACHE_KEY],
  working: [DRAFT_THE_MIGRATION],
  queue: BUSY_QUEUE,
  toSignOff: [FLAKY_LOGIN_TEST],
}

/**
 * Every section filled, with This chat, a worker running a step, an idle
 * worker, and one that ended four minutes ago and released T-013. T-014 is
 * assigned to api-server, and T-015 and T-010 to web-client.
 */
export const BUSY_BOARD: BoardSample = {
  ...BUSY_LISTS,
  backlog: BUSY_BACKLOG,
  signedOff: BUSY_SIGNED_OFF,
  sessions: [
    {
      id: 'dedicated',
      kind: 'dedicated',
      name: THIS_CHAT,
      live: true,
      holding: holdingOf(CHOOSE_THE_CACHE_KEY, 'waiting'),
    },
    {
      id: 'worker-api-server',
      kind: 'worker',
      name: API_SERVER,
      live: true,
      holding: holdingOf(DRAFT_THE_MIGRATION, 'running'),
    },
    { id: 'worker-web-client', kind: 'worker', name: WEB_CLIENT, live: true },
    {
      id: 'worker-docs',
      kind: 'worker',
      name: DOCS,
      live: false,
      endedAt: before({ minutes: 4 }),
      released: [SETUP_GUIDE.task],
    },
  ],
  counts: countsOf(BUSY_LISTS),
  updatedAt: null,
  unreachable: false,
}

const MANY_TITLES = [
  'Add retries to the billing webhooks',
  'Review the schema change for sessions',
  'Upgrade the queue client',
  'Write the release notes',
  'Fix the flaky login test',
  'Draft the cache migration',
  'Choose the cache key',
]

const MANY_QUEUE: readonly QueueSample[] = Array.from({ length: 20 }, (_, index) =>
  queued(index + 1, index + 1, MANY_TITLES[index % MANY_TITLES.length], [
    ['agent', 'pending', 'Do the work'],
    ['you', 'pending', 'Review it'],
  ])
)

const MANY_BACKLOG: readonly BacklogSample[] = Array.from({ length: 14 }, (_, index) =>
  parked(21 + index, MANY_TITLES[(index + 3) % MANY_TITLES.length], [
    [index % 2 === 0 ? 'agent' : 'you', 'pending', 'Start on it'],
  ])
)

const MANY_LISTS = { yourTurn: [], working: [], queue: MANY_QUEUE, toSignOff: [] }

/**
 * Twenty cards in the queue and fourteen in the backlog, which folds.
 */
export const MANY_BOARD: BoardSample = {
  ...MANY_LISTS,
  backlog: MANY_BACKLOG,
  signedOff: [],
  sessions: [{ id: 'dedicated', kind: 'dedicated', name: THIS_CHAT, live: true }],
  counts: countsOf(MANY_LISTS),
  updatedAt: null,
  unreachable: false,
}

/** A second session name of 40 characters. */
const LONG_NAME_2 = `${LONG_TEXT.name.slice(0, -1)}3`

const LONG_ASKS = agentAsks(
  1,
  LONG_TEXT.title,
  [
    ['agent', 'waiting', LONG_TEXT.title, LONG_TEXT.name],
    ['you', 'pending', LONG_TEXT.title],
  ],
  LONG_TEXT.message,
  before({ minutes: 3 })
)

const LONG_WORKER_2: WorkerSample = { id: 'worker-long-2', name: LONG_NAME_2 }

const LONG_RUNNING = running(
  2,
  LONG_TEXT.title,
  [
    ['agent', 'done', LONG_TEXT.title],
    ['agent', 'running', LONG_TEXT.title, LONG_NAME_2],
  ],
  INSTANTS.stepStarted,
  LONG_TEXT.message
)

const LONG_LISTS = {
  yourTurn: [LONG_ASKS],
  working: [LONG_RUNNING],
  queue: [
    assigned(queued(1, 3, LONG_TEXT.title, [['agent', 'pending', LONG_TEXT.title]]), LONG_WORKER_2),
  ],
  toSignOff: [
    finished(5, LONG_TEXT.title, [['agent', 'done', LONG_TEXT.title]], {
      finishedAt: INSTANTS.earlierToday,
      agentSeconds: 600,
      yourSeconds: 0,
      linkCount: 1,
    }),
  ],
}

/**
 * Titles of 120 characters and session names of 40 in every section, with the
 * queued and backlog tasks assigned to a worker of 40.
 */
export const LONG_TEXT_BOARD: BoardSample = {
  ...LONG_LISTS,
  backlog: [
    assigned(parked(4, LONG_TEXT.title, [['you', 'pending', LONG_TEXT.title]]), LONG_WORKER_2),
  ],
  signedOff: [{ task: taskOf(6, LONG_TEXT.title), signedOffAt: INSTANTS.yesterday }],
  sessions: [
    {
      id: 'worker-long-1',
      kind: 'worker',
      name: LONG_TEXT.name,
      live: true,
      holding: holdingOf(LONG_ASKS, 'waiting'),
    },
    {
      id: 'worker-long-2',
      kind: 'worker',
      name: LONG_NAME_2,
      live: true,
      holding: holdingOf(LONG_RUNNING, 'running'),
    },
  ],
  counts: countsOf(LONG_LISTS),
  updatedAt: null,
  unreachable: false,
}

/** api-server blocked the deploy of T-030 twenty minutes ago. */
const DEPLOY_BLOCKED = workerBlocks(
  30,
  'Roll out the sessions table',
  [
    ['agent', 'done', 'Write the migration'],
    ['agent', 'waiting', 'Deploy', API_SERVER],
    ['you', 'pending', 'Check the sessions on staging'],
  ],
  'Needs AWS credentials: the deploy role for the staging account has expired, and it can only be renewed from your machine.',
  before({ minutes: 20 })
)

const BLOCKED_LISTS = {
  yourTurn: [DEPLOY_BLOCKED, REVIEW_THE_PR, CHOOSE_THE_CACHE_KEY],
  working: [],
  queue: BUSY_QUEUE,
  toSignOff: [],
}

/**
 * Your turn holds a step api-server blocked, your own step and This chat's
 * question, the three kinds of card together. api-server holds the blocked
 * step.
 */
export const BLOCKED_BOARD: BoardSample = {
  ...BLOCKED_LISTS,
  backlog: [],
  signedOff: [],
  sessions: [
    {
      id: 'dedicated',
      kind: 'dedicated',
      name: THIS_CHAT,
      live: true,
      holding: holdingOf(CHOOSE_THE_CACHE_KEY, 'waiting'),
    },
    {
      id: 'worker-api-server',
      kind: 'worker',
      name: API_SERVER,
      live: true,
      holding: holdingOf(DEPLOY_BLOCKED, 'blocked'),
    },
    { id: 'worker-web-client', kind: 'worker', name: WEB_CLIENT, live: true },
  ],
  counts: countsOf(BLOCKED_LISTS),
  updatedAt: null,
  unreachable: false,
}

/**
 * Every named board, for tests that check them all.
 */
export const NAMED_BOARDS = {
  EMPTY_BOARD,
  BUSY_BOARD,
  MANY_BOARD,
  LONG_TEXT_BOARD,
  BLOCKED_BOARD,
} as const
