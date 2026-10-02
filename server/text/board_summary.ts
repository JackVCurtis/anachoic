import { OUTPUT_FORMAT_WORDS } from '../../shared/output_format.js'
import type { Artifact, BoardProps, SessionItem, TaskRef } from '../../shared/props.js'

/**
 * The summary must stay under this many tokens for a board of 100 tasks and
 * 10 sessions, because workers in Claude Code read it as their result.
 */
export const SUMMARY_TOKEN_BUDGET = 2000

/**
 * The estimate the budget is checked with: one token per 4 characters, which
 * counts more tokens than English text, ids and punctuation take.
 */
export const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * The summary has seven lines; each list line gets an equal share of the
 * budget and is cut short with a count of what was left out.
 */
const LINE_CHARS = Math.floor((SUMMARY_TOKEN_BUDGET * CHARS_PER_TOKEN) / 7)
const TITLE_CHARS = 60
const QUESTION_CHARS = 80
const URL_CHARS = 100
const ARTIFACTS_SHOWN = 3

const SEPARATOR = ' · '
const NONE = 'none'

function cut(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`
}

function quoted(text: string, length = TITLE_CHARS) {
  return `"${cut(text, length)}"`
}

/**
 * " → api-server" after a task assigned to a worker, else nothing.
 */
function assignee(task: TaskRef) {
  return task.assignedTo ? ` → ${task.assignedTo.name}` : ''
}

function titled(task: TaskRef) {
  return `${task.displayId} ${quoted(task.title)}${assignee(task)}`
}

/**
 * A task's artifact links, to follow it: " (step 2: Pull request https://…)".
 * Long URLs are cut and only the first few are listed, so one task cannot
 * take its line's share of the budget.
 */
function withArtifacts(artifacts: readonly Artifact[] | undefined) {
  if (!artifacts || artifacts.length === 0) return ''
  const shown = artifacts
    .slice(0, ARTIFACTS_SHOWN)
    .map(
      ({ stepNumber, format, url }) =>
        `step ${stepNumber}: ${OUTPUT_FORMAT_WORDS[format].shown} ${cut(url, URL_CHARS)}`
    )
  const rest = artifacts.length - shown.length
  return ` (${shown.join(', ')}${rest > 0 ? `, and ${rest} more` : ''})`
}

/**
 * The time since an instant, as "12m", "3h 5m" or "2d 4h".
 */
export function since(from: string, now: string): string {
  const minutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return hours % 24 === 0 ? `${days}d` : `${days}d ${hours % 24}h`
}

/**
 * `head` and as many items as fit in the line, then how many were left out.
 */
function fitted(head: string, items: readonly string[], separator = SEPARATOR) {
  if (items.length === 0) return `${head}${NONE}`
  let line = head
  for (const [index, item] of items.entries()) {
    const rest = items.length - index - 1
    const room = LINE_CHARS - (rest === 0 ? 0 : `${separator}and ${rest} more`.length)
    const next = index === 0 ? `${line}${item}` : `${line}${separator}${item}`
    if (next.length > room && index > 0) {
      return `${line}${separator}and ${items.length - index} more`
    }
    line = next
  }
  return line
}

function list(label: string, items: readonly string[], separator = SEPARATOR) {
  return fitted(`${label} (${items.length}): `, items, separator)
}

function sessionText(session: SessionItem, now: string) {
  if (!session.live) {
    const ended = session.endedAt ? `ended ${since(session.endedAt, now)} ago` : 'not responding'
    const released = session.released?.length
      ? `, released ${session.released.map(({ displayId }) => displayId).join(', ')}`
      : ''
    return `${session.name} (${ended}${released})`
  }
  if (session.kind === 'dedicated') return session.name
  if (session.holding?.status === 'blocked') {
    const { task, step } = session.holding
    return `${session.name} (live, blocked on ${task.displayId} step ${step.number})`
  }
  return session.holding ? `${session.name} (live)` : `${session.name} (live, idle)`
}

/**
 * The board as compact text for the model: a revision line, then one line
 * for each list with its count, and a line for the sessions.
 */
export function boardSummary(board: BoardProps): string {
  const sessions = board.sessions.map((session) => sessionText(session, board.now))
  return [
    `Board, revision ${board.revision}`,
    list(
      'Waiting on user',
      board.yourTurn.map(({ task, step, session, blocked }) => {
        const head = `${task.displayId}${assignee(task)} step ${step.number} ${quoted(step.title)}`
        if (step.owner === 'you') return `${head} is the user's`
        if (blocked) {
          const who = session ? ` (${session.name})` : ''
          return `${head} is blocked${who}: ${cut(blocked.reason, QUESTION_CHARS)}`
        }
        const asks = step.question ? ` asks: ${quoted(step.question, QUESTION_CHARS)}` : ' waits'
        return `${head}${asks}${session ? ` (${session.name})` : ''}`
      })
    ),
    list(
      'Working',
      board.working.map(
        ({ task, step, session, artifacts }) =>
          `${task.displayId}${assignee(task)} step ${step.number} ${quoted(step.title)} (${session.name}, ${since(step.runningSince, board.now)})${withArtifacts(artifacts)}`
      )
    ),
    list(
      'Queue',
      board.queue.map(
        ({ task, position, nextOwner, artifacts }) =>
          `${position}. ${titled(task)} next: ${nextOwner}${withArtifacts(artifacts)}`
      )
    ),
    list(
      'Backlog',
      board.backlog.map(
        ({ task, artifacts }) => `${task.displayId}${assignee(task)}${withArtifacts(artifacts)}`
      ),
      ', '
    ),
    list(
      'To sign off',
      board.toSignOff.map(({ task, artifacts }) => `${titled(task)}${withArtifacts(artifacts)}`)
    ),
    sessions.length === 0 ? `Sessions: ${NONE}` : fitted('Sessions: ', sessions),
  ].join('\n')
}
