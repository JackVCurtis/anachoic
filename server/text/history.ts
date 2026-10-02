import type { HistoryProps, HistoryRow } from '../../shared/props.js'
import { CHARS_PER_TOKEN, estimateTokens } from './board_summary.js'

/**
 * show_history's text must stay under this many tokens with a full page of
 * long rows.
 */
export const HISTORY_TEXT_TOKEN_BUDGET = 2000

const TITLE_CHARS = 60

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function cut(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`
}

/**
 * An instant's day in UTC, as "2 Oct".
 */
export function dayOf(instant: string): string {
  const date = new Date(instant)
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

function rowLine({ task, signedOffAt, artifacts }: HistoryRow) {
  const links = artifacts.length === 0 ? '' : ` · ${plural(artifacts.length, 'link')}`
  return `${task.displayId} “${cut(task.title, TITLE_CHARS)}” · signed off ${dayOf(signedOffAt)}${links}`
}

/**
 * show_history's text: how many tasks are completed, or match the filter,
 * then one line for each task on the page, and which page it is when there
 * are more.
 */
export function historyText(history: HistoryProps): string {
  const matching = history.filter === '' ? '' : ` match “${cut(history.filter, TITLE_CHARS)}”`
  const head = `${plural(history.total, 'completed task')}${matching}`
  const lines = [head, ...history.rows.map(rowLine)]
  if (history.pageCount > 1) {
    lines.push(
      `Page ${history.page} of ${history.pageCount}; the History view pages through the rest.`
    )
  }
  const text = lines.join('\n')
  return estimateTokens(text) < HISTORY_TEXT_TOKEN_BUDGET
    ? text
    : cut(text, HISTORY_TEXT_TOKEN_BUDGET * CHARS_PER_TOKEN - 4)
}
