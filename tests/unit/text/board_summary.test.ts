import { describe, expect, test } from 'vitest'
import { emptyBoard } from '../../../server/props/empty_board.js'
import {
  boardSummary,
  estimateTokens,
  SUMMARY_TOKEN_BUDGET,
} from '../../../server/text/board_summary.js'
import { boardPropsSchema, type BoardProps, type TaskRef } from '../../../shared/props.js'

describe('the empty board', () => {
  test('is at revision 0 with every list empty and every count 0, and parses as board props', () => {
    const board = emptyBoard(new Date('2026-10-01T12:00:00Z'))

    expect(boardPropsSchema.parse(board)).toEqual({
      revision: 0,
      now: '2026-10-01T12:00:00.000Z',
      yourTurn: [],
      working: [],
      queue: [],
      backlog: [],
      toSignOff: [],
      signedOff: [],
      sessions: [],
      workers: [],
      counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
    })
  })

  test('is summarised as its revision and each list with a count of 0', () => {
    expect(boardSummary(emptyBoard())).toBe(
      [
        'Board, revision 0',
        'Your turn (0): none',
        'Working (0): none',
        'Queue (0): none',
        'Backlog (0): none',
        'To sign off (0): none',
        'Sessions: none',
      ].join('\n')
    )
  })
})

const NOW = '2026-10-01T12:00:00.000Z'

function minutesAgo(minutes: number) {
  return new Date(Date.parse(NOW) - minutes * 60_000).toISOString()
}

function ref(number: number, title = `Task ${number}`): TaskRef {
  return { id: String(number), displayId: `T-${String(number).padStart(3, '0')}`, title }
}

const API = { id: 'session-a', name: 'api-server' }

function working(number: number, title: string, minutes: number): BoardProps['working'][number] {
  return {
    task: ref(number),
    step: { number: 1, title, runningSince: minutesAgo(minutes) },
    session: API,
    steps: [],
  }
}

function queued(position: number, number: number, title: string): BoardProps['queue'][number] {
  return {
    task: ref(number, title),
    position,
    nextOwner: 'agent',
    steps: [],
    canAct: { reorder: true, backlog: true },
  }
}

/**
 * The board of 06's example summary.
 */
const EXAMPLE: BoardProps = {
  revision: 214,
  now: NOW,
  yourTurn: [
    {
      task: ref(12),
      step: {
        number: 2,
        title: 'Choose the cache key',
        owner: 'agent',
        question: 'Redis or in-process?',
        waitingSince: minutesAgo(3),
      },
      session: API,
      steps: [],
      canAct: { complete: false, answer: true, park: true },
    },
    {
      task: ref(9),
      step: { number: 3, title: 'Review the PR', owner: 'you', waitingSince: minutesAgo(1) },
      steps: [],
      canAct: { complete: true, answer: false, park: true },
    },
  ],
  working: [
    working(14, 'Draft the migration', 12),
    working(16, 'Write tests', 3),
    working(17, 'Profile the import', 75),
  ],
  queue: [
    queued(1, 15, 'Add retries'),
    queued(2, 18, 'Rate limits'),
    queued(3, 19, 'Docs'),
    queued(4, 20, 'Cleanup'),
  ],
  backlog: [3, 4, 7, 8, 10, 11].map((number) => ({
    task: ref(number),
    steps: [],
    canAct: { queue: true, archive: true },
  })),
  toSignOff: [
    {
      task: ref(6, 'Fix flaky login test'),
      finishedAt: minutesAgo(30),
      agentSeconds: 600,
      yourSeconds: 60,
      linkCount: 1,
      steps: [],
      canAct: { signOff: true, followUp: true, archive: true },
    },
  ],
  signedOff: [],
  sessions: [
    { id: 'dedicated', kind: 'dedicated', name: 'This chat', live: true },
    {
      id: API.id,
      kind: 'worker',
      name: API.name,
      live: true,
      holding: {
        task: ref(14),
        step: { number: 1, title: 'Draft the migration' },
        status: 'running',
      },
    },
    { id: 'session-b', kind: 'worker', name: 'web-client', live: true },
    {
      id: 'session-c',
      kind: 'worker',
      name: 'docs',
      live: false,
      endedAt: minutesAgo(4),
      released: [ref(13)],
    },
  ],
  counts: { yourTurn: 2, working: 3, queue: 4, toSignOff: 1 },
}

describe('the board summary', () => {
  test('matches 06’s example line for line, where the example elides nothing', () => {
    const lines = boardSummary(boardPropsSchema.parse(EXAMPLE)).split('\n')
    const expected = [
      'Board, revision 214',
      'Your turn (2): T-012 step 2 "Choose the cache key" asks: "Redis or in-process?" (api-server) · T-009 step 3 "Review the PR" is yours',
      'Working (3): T-014 step 1 "Draft the migration" (api-server, 12m) · …',
      'Queue (4): 1. T-015 "Add retries" next: agent · 2. …',
      'Backlog (6): T-003, T-004, T-007, T-008, T-010, T-011',
      'To sign off (1): T-006 "Fix flaky login test"',
      'Sessions: This chat · api-server (live) · web-client (live, idle) · docs (ended 4m ago, released T-013)',
    ]

    expect(lines).toHaveLength(expected.length)
    for (const [index, line] of expected.entries()) {
      if (line.endsWith('…')) expect(lines[index].startsWith(line.slice(0, -1))).toBe(true)
      else expect(lines[index]).toBe(line)
    }
    expect(lines[2]).toBe(
      'Working (3): T-014 step 1 "Draft the migration" (api-server, 12m) · T-016 step 1 "Write tests" (api-server, 3m) · T-017 step 1 "Profile the import" (api-server, 1h 15m)'
    )
  })

  test('stays under its token budget for 100 tasks and 10 sessions with the longest text', () => {
    const long = 'x'.repeat(200)
    const sessions: BoardProps['sessions'] = Array.from({ length: 10 }, (_, index) => ({
      id: `session-${index}`,
      kind: 'worker',
      name: 'n'.repeat(40),
      live: index < 5,
      ...(index < 5
        ? {}
        : { endedAt: minutesAgo(5), released: Array.from({ length: 10 }, (__, n) => ref(n + 1)) }),
    }))
    const board: BoardProps = {
      ...EXAMPLE,
      yourTurn: Array.from({ length: 20 }, (_, index) => ({
        ...EXAMPLE.yourTurn[0],
        task: ref(index + 1, long),
        step: { ...EXAMPLE.yourTurn[0].step, title: long, question: 'q'.repeat(2000) },
        session: { id: 'session-0', name: 'n'.repeat(40) },
      })),
      working: Array.from({ length: 20 }, (_, index) => working(index + 21, long, 30)),
      queue: Array.from({ length: 20 }, (_, index) => queued(index + 1, index + 41, long)),
      backlog: Array.from({ length: 20 }, (_, index) => ({
        ...EXAMPLE.backlog[0],
        task: ref(index + 61, long),
      })),
      toSignOff: Array.from({ length: 20 }, (_, index) => ({
        ...EXAMPLE.toSignOff[0],
        task: ref(index + 81, long),
      })),
      sessions,
    }

    const summary = boardSummary(boardPropsSchema.parse(board))
    expect(estimateTokens(summary)).toBeLessThan(SUMMARY_TOKEN_BUDGET)
    const lines = summary.split('\n')
    expect(lines[1]).toMatch(/^Your turn \(20\): .* · and \d+ more$/)
    expect(lines[3]).toMatch(/^Queue \(20\): 1\. T-041 "x{59}…" next: agent · .* · and \d+ more$/)
    expect(lines[4]).toBe(
      `Backlog (20): ${Array.from({ length: 20 }, (_, index) => ref(index + 61).displayId).join(', ')}`
    )
  })
})

describe('a blocked step in the summary', () => {
  const blockedItem: BoardProps['yourTurn'][number] = {
    task: ref(12),
    step: { number: 2, title: 'Deploy', owner: 'agent', waitingSince: minutesAgo(14) },
    session: API,
    blocked: { reason: 'needs AWS credentials', since: minutesAgo(14) },
    steps: [],
    canAct: { complete: false, answer: false, park: true },
  }

  test('is named in the Your turn line with its worker and reason, and on its session', () => {
    const board: BoardProps = {
      ...EXAMPLE,
      yourTurn: [blockedItem],
      sessions: [
        {
          id: API.id,
          kind: 'worker',
          name: API.name,
          live: true,
          holding: { task: ref(12), step: { number: 2, title: 'Deploy' }, status: 'blocked' },
        },
      ],
    }
    const lines = boardSummary(boardPropsSchema.parse(board)).split('\n')
    expect(lines[1]).toBe(
      'Your turn (1): T-012 step 2 "Deploy" is blocked (api-server): needs AWS credentials'
    )
    expect(lines[6]).toBe('Sessions: api-server (live, blocked on T-012 step 2)')
  })

  test('stays under the token budget with 20 blocked items of the longest reason', () => {
    const long = 'x'.repeat(200)
    const board: BoardProps = {
      ...EXAMPLE,
      yourTurn: Array.from({ length: 20 }, (_, index) => ({
        ...blockedItem,
        task: ref(index + 1, long),
        step: { ...blockedItem.step, title: long },
        session: { id: 'session-0', name: 'n'.repeat(40) },
        blocked: { reason: 'r'.repeat(2000), since: minutesAgo(5) },
      })),
    }
    const summary = boardSummary(boardPropsSchema.parse(board))
    expect(estimateTokens(summary)).toBeLessThan(SUMMARY_TOKEN_BUDGET)
    expect(summary.split('\n')[1]).toMatch(/^Your turn \(20\): .* is blocked .* · and \d+ more$/)
  })
})
