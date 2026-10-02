/**
 * The board view on a fresh install: nothing waiting, nothing running,
 * nothing queued and no session yet.
 */
export const EMPTY_BOARD_VIEW = {
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
  safeAreaInsets: null,
}

const TITLES = [
  'Add retries to the billing webhooks',
  'Review the schema change for sessions',
  'Upgrade the queue client',
  'Write the release notes',
  'Fix the flaky login test',
  'Draft the cache migration',
  'Choose the cache key',
]

/**
 * The given number of tasks, T-001 upwards, for a section with many cards.
 */
export function numberedTasks(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    return {
      id: `task-${number}`,
      displayId: `T-${String(number).padStart(3, '0')}`,
      title: TITLES[index % TITLES.length],
    }
  })
}
