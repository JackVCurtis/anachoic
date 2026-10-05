import {
  agentAsks,
  API_SERVER,
  BLOCKED_BOARD,
  BUSY_BOARD,
  DOCS,
  finished,
  LONG_TEXT_BOARD,
  MANY_BOARD,
  parked,
  producing,
  queued,
  running,
  taskOf,
  THIS_CHAT,
  WEB_CLIENT,
  withArtifacts,
  withInput,
  workerBlocks,
  yourStep,
  type ArtifactSample,
  type SessionSample,
  type SignOffSample,
  type WorkingSample,
  type YourTurnSample,
} from './board.js'
import { before, INSTANTS } from './clock.js'
import { LONGEST_PAGE, PICK_THE_CACHE } from './forms.js'
import { LONG_TEXT } from './long_text.js'

/*
 * The cards of one section at a time, for the section and card stories. Each
 * is built from the same builders as the named boards in board.ts.
 */

const [REVIEW_THE_PR, CHOOSE_THE_CACHE_KEY] = BUSY_BOARD.yourTurn
const [DEPLOY_BLOCKED] = BLOCKED_BOARD.yourTurn

/**
 * Your turn: your own step, an agent's form, a blocked step, a form at the
 * longest a page takes, a reason of 2,000 characters with a long title and
 * worker name, a long title, and twenty cards.
 */
export const YOUR_TURN = {
  yourStep: REVIEW_THE_PR,
  question: CHOOSE_THE_CACHE_KEY,
  blocked: DEPLOY_BLOCKED,
  longBlocked: workerBlocks(
    32,
    LONG_TEXT.title,
    [
      ['agent', 'done', LONG_TEXT.title],
      ['agent', 'waiting', LONG_TEXT.title, LONG_TEXT.name],
    ],
    LONG_TEXT.answer.slice(0, 2000),
    before({ hours: 2, minutes: 5 })
  ),
  longQuestion: agentAsks(
    30,
    'Pick the retry policy for the billing webhooks',
    [
      ['agent', 'done', 'Read the webhook logs'],
      ['agent', 'waiting', 'Choose the retry policy', THIS_CHAT],
    ],
    LONGEST_PAGE,
    before({ minutes: 2 })
  ),
  longTitle: LONG_TEXT_BOARD.yourTurn[0],
  many: Array.from({ length: 20 }, (_, index): YourTurnSample => {
    const number = 40 + index
    return index % 2 === 0
      ? yourStep(
          number,
          `Review the change for task ${number}`,
          [
            ['agent', 'done', 'Make the change'],
            ['you', 'waiting', 'Review the change'],
          ],
          before({ minutes: 20 - index })
        )
      : agentAsks(
          number,
          `Choose the approach for task ${number}`,
          [['agent', 'waiting', 'Choose the approach', THIS_CHAT]],
          PICK_THE_CACHE,
          before({ minutes: 20 - index })
        )
  }),
} as const

/**
 * A live worker holding the given step of a task, or nothing.
 */
function worker(
  name: string,
  holding?: {
    number: number
    title: string
    step: number
    stepTitle: string
    status: 'running' | 'waiting' | 'blocked'
  }
): SessionSample {
  return {
    id: `worker-${name}`,
    kind: 'worker',
    name,
    live: true,
    ...(holding && {
      holding: {
        task: taskOf(holding.number, holding.title),
        step: { number: holding.step, title: holding.stepTitle },
        status: holding.status,
      },
    }),
  }
}

const [THIS_CHAT_WAITING, API_SERVER_RUNNING, WEB_CLIENT_IDLE, DOCS_ENDED] = BUSY_BOARD.sessions
const [, API_SERVER_BLOCKED] = BLOCKED_BOARD.sessions

/**
 * Sessions: this chat holding a step, workers running, waiting and blocked, idle
 * sessions, an ended session that released two tasks, twelve live sessions
 * and long names.
 */
export const SESSIONS = {
  thisChat: THIS_CHAT_WAITING,
  running: API_SERVER_RUNNING,
  idle: WEB_CLIENT_IDLE,
  ended: DOCS_ENDED,
  busy: BUSY_BOARD.sessions,
  blocked: API_SERVER_BLOCKED,
  waitingWorker: worker('billing', {
    number: 15,
    title: 'Add retries to the billing webhooks',
    step: 1,
    stepTitle: 'Add retries with backoff',
    status: 'waiting',
  }),
  severalWorkers: [
    API_SERVER_RUNNING,
    worker(WEB_CLIENT, {
      number: 19,
      title: 'Upgrade the queue client',
      step: 2,
      stepTitle: 'Upgrade the client and fix the call sites',
      status: 'running',
    }),
    worker('billing', {
      number: 15,
      title: 'Add retries to the billing webhooks',
      step: 1,
      stepTitle: 'Add retries with backoff',
      status: 'waiting',
    }),
    worker(DOCS, {
      number: 13,
      title: 'Write the setup guide',
      step: 2,
      stepTitle: 'Write the troubleshooting section',
      status: 'running',
    }),
  ],
  idleSessions: [
    { id: 'dedicated', kind: 'dedicated', name: THIS_CHAT, live: true },
    WEB_CLIENT_IDLE,
    worker('search'),
  ],
  endedTwo: {
    id: 'worker-reports',
    kind: 'worker',
    name: 'reports',
    live: false,
    endedAt: before({ minutes: 4 }),
    released: [
      taskOf(26, 'Fix the timezone in the monthly report'),
      taskOf(27, 'Add a CSV export to the report'),
    ],
  },
  many: Array.from({ length: 12 }, (_, index) =>
    index % 3 === 0
      ? worker(`worker-${index + 1}`)
      : worker(`worker-${index + 1}`, {
          number: 60 + index,
          title: `Task for worker ${index + 1}`,
          step: 1,
          stepTitle: 'Do the work',
          status: index % 3 === 1 ? 'running' : 'waiting',
        })
  ),
  long: LONG_TEXT_BOARD.sessions,
} as const satisfies Record<string, SessionSample | readonly SessionSample[]>

const [DRAFT_THE_MIGRATION] = BUSY_BOARD.working

/**
 * Working: one task, several sessions at once, this chat working, no note, a
 * note of 500 characters, a long title, and twelve cards.
 */
export const WORKING = {
  one: DRAFT_THE_MIGRATION,
  fourSteps: running(
    31,
    'Move the invoices to the new table',
    [
      ['agent', 'done', 'Write the new table', 'billing'],
      ['agent', 'running', 'Draft the migration', 'billing'],
      ['you', 'pending', 'Review the migration'],
      ['agent', 'pending', 'Run it on staging'],
    ],
    before({ minutes: 6, seconds: 12 }),
    'Copying the invoice rows in batches of 500.'
  ),
  severalSessions: [
    DRAFT_THE_MIGRATION,
    running(
      19,
      'Upgrade the queue client',
      [
        ['you', 'done', 'Choose the version to move to'],
        ['agent', 'running', 'Upgrade the client and fix the call sites', WEB_CLIENT],
        ['agent', 'pending', 'Run the load test'],
      ],
      before({ minutes: 3, seconds: 40 }),
      'Fixed 14 of 22 call sites.'
    ),
    running(
      13,
      'Write the setup guide',
      [
        ['agent', 'done', 'Outline the setup guide'],
        ['agent', 'running', 'Write the troubleshooting section', DOCS],
        ['you', 'pending', 'Read the guide through'],
      ],
      before({ hours: 1, minutes: 4 })
    ),
  ],
  thisChat: running(
    32,
    'Write the release notes',
    [
      ['agent', 'running', 'Write the release notes', THIS_CHAT],
      ['you', 'pending', 'Read the release notes'],
    ],
    before({ minutes: 2 }),
    'Listing the changes since the last release.'
  ),
  noNote: running(
    33,
    'Bump the SDK to the latest minor',
    [['agent', 'running', 'Bump the SDK', WEB_CLIENT]],
    before({ seconds: 40 })
  ),
  longNote: running(
    34,
    'Move the billing consumers to the event bus',
    [
      ['agent', 'done', 'Map the consumers', DOCS],
      ['agent', 'running', 'Move the consumers', DOCS],
    ],
    before({ minutes: 25 }),
    LONG_TEXT.answer.slice(0, 500)
  ),
  longTitle: LONG_TEXT_BOARD.working[0],
  many: Array.from({ length: 12 }, (_, index): WorkingSample =>
    running(
      70 + index,
      `Task for worker ${index + 1}`,
      [
        ['agent', 'running', 'Do the work', `worker-${index + 1}`],
        ['you', 'pending', 'Review it'],
      ],
      before({ minutes: 12 - index })
    )
  ),
} as const

/**
 * Queue: one card, starts and resumes, twenty cards and a long title.
 */
export const QUEUE = {
  one: [BUSY_BOARD.queue[0]],
  busy: BUSY_BOARD.queue,
  twenty: MANY_BOARD.queue,
  longTitle: [...LONG_TEXT_BOARD.queue, ...BUSY_BOARD.queue.slice(1)],
} as const

/**
 * Backlog: a few tasks, fourteen that fold, a long title, and a task that
 * cannot be queued.
 */
export const BACKLOG = {
  busy: BUSY_BOARD.backlog,
  fourteen: MANY_BOARD.backlog,
  longTitle: [...LONG_TEXT_BOARD.backlog, ...BUSY_BOARD.backlog.slice(0, 2)],
  cannotQueue: {
    ...parked(35, 'Decide what the archive keeps', [
      ['you', 'pending', 'List what the archive must keep'],
      ['agent', 'pending', 'Write the archive job'],
    ]),
    canAct: { queue: false, archive: true },
  },
} as const

const [FLAKY_LOGIN_TEST] = BUSY_BOARD.toSignOff

const ADD_A_RETRY = finished(
  36,
  'Add a retry to the export job',
  [
    ['agent', 'done', 'Add the retry'],
    ['you', 'done', 'Review the PR'],
  ],
  { finishedAt: before({ minutes: 20 }), agentSeconds: 840, yourSeconds: 360, linkCount: 1 }
)

/**
 * Done: tasks to sign off, with and without links, twelve that fold, a long
 * title, and the ten most recently signed off.
 */
export const DONE = {
  flaky: FLAKY_LOGIN_TEST,
  two: [FLAKY_LOGIN_TEST, ADD_A_RETRY],
  oneLink: ADD_A_RETRY,
  twoLinks: finished(
    37,
    'Tidy the error messages in the importer',
    [
      ['agent', 'done', 'Tidy the messages'],
      ['you', 'done', 'Read them through'],
    ],
    { finishedAt: INSTANTS.earlierToday, agentSeconds: 840, yourSeconds: 360, linkCount: 2 }
  ),
  noLinks: finished(38, 'Remove the unused env vars', [['agent', 'done', 'Remove them']], {
    finishedAt: INSTANTS.yesterday,
    agentSeconds: 300,
    yourSeconds: 0,
    linkCount: 0,
  }),
  twelve: Array.from({ length: 12 }, (_, index): SignOffSample =>
    finished(80 + index, `Finished task ${index + 1}`, [['agent', 'done', 'Do the work']], {
      finishedAt: before({ hours: index }),
      agentSeconds: 600 + index * 60,
      yourSeconds: 120,
      linkCount: index % 3,
    })
  ),
  longTitle: LONG_TEXT_BOARD.toSignOff[0],
  signedOff: BUSY_BOARD.signedOff,
} as const

const PULL_REQUEST: ArtifactSample = {
  stepNumber: 1,
  format: 'pull_request',
  url: 'https://github.com/acme/billing/pull/412',
}

const TICKET: ArtifactSample = {
  stepNumber: 2,
  format: 'ticket',
  url: 'https://acme.atlassian.net/browse/BILL-88',
}

/** A link of 2,000 characters, the longest the tools take. */
const LONG_DOCUMENT: ArtifactSample = {
  stepNumber: 1,
  format: 'document',
  url: `https://docs.example.com/d/${'a'.repeat(2000 - 'https://docs.example.com/d/'.length)}`,
}

/**
 * Output formats on agent steps: user steps handed a pull request or a
 * 2,000-character document link by the agent step before them, a running
 * step that must produce a document, and a card of each other section with
 * the links its done steps produced.
 */
export const OUTPUTS = {
  handedPullRequest: withInput(
    yourStep(
      90,
      'Add retries to the billing webhooks',
      [
        ['agent', 'done', 'Open the PR'],
        ['you', 'waiting', 'Review the PR'],
        ['agent', 'pending', 'Merge and watch the build'],
      ],
      before({ minutes: 8 })
    ),
    PULL_REQUEST
  ),
  handedLongDocument: withInput(
    yourStep(
      91,
      'Share the design review',
      [
        ['agent', 'done', 'Write the design doc'],
        ['you', 'waiting', 'Read the design doc'],
      ],
      before({ minutes: 3 })
    ),
    LONG_DOCUMENT
  ),
  working: withArtifacts(
    producing(
      running(
        92,
        'Add retries to the billing webhooks',
        [
          ['agent', 'done', 'Open the PR', API_SERVER],
          ['agent', 'done', 'File the follow-up ticket', API_SERVER],
          ['you', 'done', 'Review the PR'],
          ['agent', 'running', 'Write the release notes', API_SERVER],
        ],
        before({ minutes: 4 })
      ),
      'document'
    ),
    [PULL_REQUEST, TICKET]
  ),
  queued: withArtifacts(
    queued(1, 93, 'Roll out the new invoice layout', [
      ['agent', 'done', 'Open the PR'],
      ['you', 'done', 'Review the PR'],
      ['agent', 'pending', 'Roll it out'],
    ]),
    [PULL_REQUEST]
  ),
  parked: withArtifacts(
    parked(94, 'Write up the billing outage', [
      ['agent', 'done', 'Draft the write-up'],
      ['you', 'pending', 'Review the write-up'],
    ]),
    [LONG_DOCUMENT]
  ),
  finished: withArtifacts(
    finished(
      95,
      'Fix the rounding in the tax report',
      [
        ['agent', 'done', 'Open the PR'],
        ['agent', 'done', 'File the follow-up ticket'],
        ['you', 'done', 'Review the PR'],
      ],
      { finishedAt: before({ minutes: 30 }), agentSeconds: 1_200, yourSeconds: 300, linkCount: 2 }
    ),
    [PULL_REQUEST, TICKET]
  ),
} as const

/**
 * Rejecting an agent's output: a user step handed a pull request, and a
 * finished task whose last step is an agent's, each of which can send that
 * step back.
 */
export const REJECTABLE = {
  yourStep: {
    ...OUTPUTS.handedPullRequest,
    canAct: { ...OUTPUTS.handedPullRequest.canAct, reject: true },
  },
  finished: { ...DONE.noLinks, canAct: { ...DONE.noLinks.canAct, reject: true } },
} as const
