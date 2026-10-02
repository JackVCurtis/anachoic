import { fillTemplate, history } from './strings'
import { formatDuration } from './time'
import { plural } from './words'

/**
 * How long the filter field waits after the last keystroke before it filters.
 */
export const FILTER_DELAY_MS = 300

/**
 * The line beside the History title: "38 completed tasks".
 */
export function historySummary(total: number): string {
  return fillTemplate(history.summary, { 'n completed tasks': plural(total, 'completed task') })
}

/**
 * The Pagination label: "Page 2 of 3".
 */
export function pageLabel(page: number, pageCount: number): string {
  return fillTemplate(history.page, { n: page, m: pageCount })
}

/**
 * The Steps cell's count: "4 steps".
 */
export function stepCount(count: number): string {
  return fillTemplate(history.steps, { 'n steps': plural(count, 'step') })
}

/**
 * The Agent / User cell: "14m / 6m", with "—" for a time of zero.
 */
export function timesCell(agentSeconds: number, userSeconds: number): string {
  return fillTemplate(history.times, {
    agent: formatDuration(agentSeconds),
    user: formatDuration(userSeconds),
  })
}
