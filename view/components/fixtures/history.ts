import {
  API_SERVER,
  chainOf,
  taskOf,
  WEB_CLIENT,
  type ArtifactSample,
  type StepSpec,
  type TaskSample,
} from './board.js'
import { before, INSTANTS } from './clock.js'
import { LONG_TEXT } from './long_text.js'
import type { PipStepSample } from './pip_steps.js'

/*
 * The shapes below mirror CompletedTask and HistoryPage in
 * board/board_data.ts, which fixtures may not import.
 */

export interface CompletedSample {
  task: TaskSample
  signedOffAt: string
  steps: readonly PipStepSample[]
  agentSeconds: number
  userSeconds: number
  workers: readonly string[]
  artifacts: readonly ArtifactSample[]
}

export interface HistoryPageSample {
  rows: readonly CompletedSample[]
  page: number
  pageCount: number
  total: number
  filter: string
}

function completedTask(
  number: number,
  title: string,
  specs: readonly StepSpec[],
  facts: Omit<CompletedSample, 'task' | 'steps'>
): CompletedSample {
  const task = taskOf(number, title)
  return { task, steps: chainOf(task, specs), ...facts }
}

const PULL_REQUEST: ArtifactSample = {
  stepNumber: 1,
  format: 'pull_request',
  url: 'https://github.com/acme/billing/pull/412',
}

const TICKET: ArtifactSample = {
  stepNumber: 3,
  format: 'ticket',
  url: 'https://acme.atlassian.net/browse/BILL-88',
}

const FIX_THE_FLAKY_LOGIN_TEST = completedTask(
  12,
  'Fix the flaky login test',
  [
    ['agent', 'done', 'Find the race', API_SERVER],
    ['you', 'done', 'Review the PR'],
    ['agent', 'done', 'File the follow-up ticket', API_SERVER],
    ['agent', 'done', 'Merge and watch the build', WEB_CLIENT],
  ],
  {
    signedOffAt: INSTANTS.earlierToday,
    agentSeconds: 14 * 60,
    userSeconds: 6 * 60,
    workers: [API_SERVER, WEB_CLIENT],
    artifacts: [PULL_REQUEST, TICKET],
  }
)

const REMOVE_THE_UNUSED_ENV_VARS = completedTask(
  11,
  'Remove the unused env vars',
  [['agent', 'done', 'Remove them', API_SERVER]],
  {
    signedOffAt: INSTANTS.yesterday,
    agentSeconds: 5 * 60,
    userSeconds: 0,
    workers: [API_SERVER],
    artifacts: [],
  }
)

const WRITE_THE_RELEASE_NOTES = completedTask(
  10,
  'Write the release notes',
  [['you', 'done', 'Write them']],
  {
    signedOffAt: INSTANTS.earlierThisWeek,
    agentSeconds: 0,
    userSeconds: 25 * 60,
    workers: [],
    artifacts: [],
  }
)

/**
 * A page of twenty, numbered down from `firstNumber`, signed off an hour apart.
 */
function twenty(firstNumber: number, hoursBefore: number): CompletedSample[] {
  return Array.from({ length: 20 }, (_, index) =>
    completedTask(
      firstNumber - index,
      `Completed task ${firstNumber - index}`,
      [
        ['agent', 'done', 'Do the work', API_SERVER],
        ['you', 'done', 'Check the work'],
      ],
      {
        signedOffAt: before({ hours: hoursBefore + index }),
        agentSeconds: 600 + index * 60,
        userSeconds: 120,
        workers: [API_SERVER],
        artifacts: index % 3 === 0 ? [PULL_REQUEST] : [],
      }
    )
  )
}

/**
 * The History view's pages: none at all, one short page, the middle of three
 * pages, long titles and names, and a filter that matches nothing.
 */
export const HISTORY = {
  empty: { rows: [], page: 1, pageCount: 1, total: 0, filter: '' },
  onePage: {
    rows: [FIX_THE_FLAKY_LOGIN_TEST, REMOVE_THE_UNUSED_ENV_VARS, WRITE_THE_RELEASE_NOTES],
    page: 1,
    pageCount: 1,
    total: 3,
    filter: '',
  },
  firstOfThree: { rows: twenty(150, 1), page: 1, pageCount: 3, total: 45, filter: '' },
  secondOfThree: { rows: twenty(130, 21), page: 2, pageCount: 3, total: 45, filter: '' },
  thirdOfThree: {
    rows: twenty(110, 41).slice(0, 5),
    page: 3,
    pageCount: 3,
    total: 45,
    filter: '',
  },
  longText: {
    rows: [
      completedTask(
        6,
        LONG_TEXT.title,
        [
          ['agent', 'done', LONG_TEXT.title, LONG_TEXT.name],
          ['you', 'done', LONG_TEXT.title],
        ],
        {
          signedOffAt: INSTANTS.yesterday,
          agentSeconds: 26 * 3600,
          userSeconds: 70 * 60,
          workers: [LONG_TEXT.name, `${LONG_TEXT.name.slice(0, -1)}3`],
          artifacts: [
            PULL_REQUEST,
            { ...TICKET, stepNumber: 2 },
            { ...PULL_REQUEST, stepNumber: 12 },
          ],
        }
      ),
      FIX_THE_FLAKY_LOGIN_TEST,
    ],
    page: 1,
    pageCount: 1,
    total: 2,
    filter: '',
  },
  noMatch: { rows: [], page: 1, pageCount: 1, total: 0, filter: 'webhooks' },
  filtered: { rows: [FIX_THE_FLAKY_LOGIN_TEST], page: 1, pageCount: 1, total: 1, filter: 'flaky' },
} as const satisfies Record<string, HistoryPageSample>
