import { agentSeconds, yourSeconds } from '../../domain/derived.js'
import type { Instant } from '../../domain/types.js'
import { HISTORY_PAGE_SIZE, type HistoryProps, type HistoryRow } from '../../shared/props.js'
import type { Database } from '../../store/database.js'
import { readHistory, type HistorySnapshot } from '../../store/queries.js'
import { artifactLinks, pipsOf, taskRef } from './board.js'

/**
 * Builds the history props from one snapshot. Every fact comes from domain/
 * and the store, so the view only formats.
 */
export function historyProps(
  snapshot: HistorySnapshot,
  filter: string,
  now: Instant
): HistoryProps {
  const nameOf = (id: string) => snapshot.sessionNames.get(id) ?? id
  const rows = snapshot.tasks.map(({ task, steps }): HistoryRow => {
    const workers = new Set<string>()
    for (const step of steps) {
      const by = step.owner === 'agent' ? snapshot.completedBy.get(step.id) : undefined
      if (by !== undefined) workers.add(nameOf(by))
    }
    return {
      task: taskRef(task, nameOf),
      signedOffAt: task.signedOffAt!,
      finishedAt: task.finishedAt ?? task.signedOffAt!,
      // A signed-off task holds no step, so no pip names a session.
      steps: pipsOf(steps, () => null),
      agentSeconds: agentSeconds(steps),
      userSeconds: yourSeconds(steps),
      workers: [...workers],
      artifacts: artifactLinks(steps),
    }
  })
  return {
    revision: snapshot.revision,
    now,
    page: snapshot.page,
    pageCount: Math.max(1, Math.ceil(snapshot.total / HISTORY_PAGE_SIZE)),
    total: snapshot.total,
    filter,
    rows,
  }
}

/**
 * One page of the history as it is now, read in one snapshot. A page past
 * the end gives the last page.
 */
export function readHistoryProps(
  database: Database,
  now: Instant,
  page = 1,
  filter = ''
): HistoryProps {
  const trimmed = filter.trim()
  return historyProps(
    readHistory(database, { page, filter: trimmed, pageSize: HISTORY_PAGE_SIZE }),
    trimmed,
    now
  )
}
