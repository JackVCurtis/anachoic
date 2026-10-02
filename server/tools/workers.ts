import { invalid, type Refusal } from '../../domain/refusal.js'
import type { Instant } from '../../domain/types.js'
import type { Database } from '../../store/database.js'
import { listSessions } from '../../store/sessions.js'

export interface Worker {
  id: string
  name: string
}

/**
 * The live worker sessions, which a task can be assigned to.
 */
export function liveWorkers(database: Database, now: Instant): Worker[] {
  return listSessions(database, now)
    .filter(({ session, live }) => live && session.kind === 'worker')
    .map(({ session }) => ({ id: session.id, name: session.name }))
}

function listed(workers: readonly Worker[]) {
  return workers.map(({ id, name }) => `${name} (${id})`).join(', ')
}

/**
 * The live worker a tool's assign_to names: by its id, or else by its name
 * as the board shows it, ignoring case. An unknown or ambiguous name is
 * refused with the live workers named.
 */
export function resolveWorker(database: Database, now: Instant, ref: string): Worker | Refusal {
  const workers = liveWorkers(database, now)
  const byId = workers.find((worker) => worker.id === ref)
  if (byId) return byId
  const named = workers.filter((worker) => worker.name.toLowerCase() === ref.toLowerCase())
  if (named.length === 1) return named[0]
  if (named.length > 1) {
    return invalid(
      `“${ref}” names ${named.length} live workers. Pass one of their ids as assign_to: ${listed(named)}`
    )
  }
  return invalid(
    workers.length === 0
      ? `“${ref}” is not a live worker. No worker is live.`
      : `“${ref}” is not a live worker. Live workers: ${listed(workers)}`
  )
}
