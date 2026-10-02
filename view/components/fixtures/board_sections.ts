import {
  agentAsks,
  BUSY_BOARD,
  DOCS,
  LONG_TEXT_BOARD,
  running,
  taskOf,
  THIS_CHAT,
  WEB_CLIENT,
  yourStep,
  type SessionSample,
  type WorkingSample,
  type YourTurnSample,
} from './board.js'
import { before } from './clock.js'
import { LONG_TEXT } from './long_text.js'

/*
 * The cards of one section at a time, for the section and card stories. Each
 * is built from the same builders as the named boards in board.ts.
 */

const [REVIEW_THE_PR, CHOOSE_THE_CACHE_KEY] = BUSY_BOARD.yourTurn

/**
 * Your turn: your own step, an agent's question, a question of 2,000
 * characters, a long title, and twenty cards.
 */
export const YOUR_TURN = {
  yourStep: REVIEW_THE_PR,
  question: CHOOSE_THE_CACHE_KEY,
  longQuestion: agentAsks(
    30,
    'Pick the retry policy for the billing webhooks',
    [
      ['agent', 'done', 'Read the webhook logs'],
      ['agent', 'waiting', 'Choose the retry policy', THIS_CHAT],
    ],
    LONG_TEXT.answer.slice(0, 2000),
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
          'Keep the current schema or add a column?',
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
    status: 'running' | 'waiting'
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

/**
 * Sessions: this chat holding a step, workers running and waiting, idle
 * sessions, an ended session that released two tasks, twelve live sessions
 * and long names.
 */
export const SESSIONS = {
  thisChat: THIS_CHAT_WAITING,
  running: API_SERVER_RUNNING,
  idle: WEB_CLIENT_IDLE,
  ended: DOCS_ENDED,
  busy: BUSY_BOARD.sessions,
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
