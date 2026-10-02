import { describe, expect, test } from 'vitest'
import { estimateTokens } from '../../../server/text/board_summary.js'
import { dayOf, HISTORY_TEXT_TOKEN_BUDGET, historyText } from '../../../server/text/history.js'
import {
  HISTORY_PAGE_SIZE,
  historyPropsSchema,
  type HistoryProps,
  type HistoryRow,
} from '../../../shared/props.js'

const NOW = '2026-10-02T18:03:00.000Z'

function row(number: number, title: string, links = 0): HistoryRow {
  return {
    task: { id: String(number), displayId: `T-${String(number).padStart(3, '0')}`, title },
    signedOffAt: '2026-10-02T14:03:00.000Z',
    finishedAt: '2026-10-02T13:00:00.000Z',
    steps: [],
    agentSeconds: 600,
    userSeconds: 60,
    workers: ['api-server'],
    artifacts: Array.from({ length: links }, (_, index) => ({
      stepNumber: index + 1,
      format: 'pull_request' as const,
      url: `https://github.com/acme/app/pull/${index + 1}`,
    })),
  }
}

function history(rows: HistoryRow[], total = rows.length, filter = ''): HistoryProps {
  return historyPropsSchema.parse({
    revision: 4,
    now: NOW,
    page: 1,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    total,
    filter,
    rows,
  })
}

describe('the history text', () => {
  test('is the count, then a line for each task as 14 shows', () => {
    expect(historyText(history([row(12, 'Fix the flaky login test', 2), row(9, 'Ship it')]))).toBe(
      [
        '2 completed tasks',
        'T-012 “Fix the flaky login test” · signed off 2 Oct · 2 links',
        'T-009 “Ship it” · signed off 2 Oct',
      ].join('\n')
    )
  })

  test('says what the filter matched, and which page it is when there are more', () => {
    const text = historyText(history([row(12, 'Fix the flaky login test', 1)], 38, 'login'))
    expect(text.split('\n')).toEqual([
      '38 completed tasks match “login”',
      'T-012 “Fix the flaky login test” · signed off 2 Oct · 1 link',
      'Page 1 of 2; the History view pages through the rest.',
    ])
  })

  test('says so when nothing is completed', () => {
    expect(historyText(history([]))).toBe('0 completed tasks')
    expect(historyText(history([row(1, 'One')]))).toBe(
      '1 completed task\nT-001 “One” · signed off 2 Oct'
    )
  })

  test('stays under its token budget with 20 long rows', () => {
    const long = 'x'.repeat(200)
    const rows = Array.from({ length: HISTORY_PAGE_SIZE }, (_, index) => row(index + 980, long, 10))
    const text = historyText(history(rows, 1000, 'f'.repeat(200)))

    expect(estimateTokens(text)).toBeLessThan(HISTORY_TEXT_TOKEN_BUDGET)
    expect(text.split('\n')).toHaveLength(HISTORY_PAGE_SIZE + 2)
    expect(text).toContain(`T-980 “${'x'.repeat(59)}…” · signed off 2 Oct · 10 links`)
  })

  test('gives the day in UTC', () => {
    expect(dayOf('2026-10-02T23:59:00.000Z')).toBe('2 Oct')
    expect(dayOf('2026-01-31T00:00:00.000Z')).toBe('31 Jan')
  })
})
