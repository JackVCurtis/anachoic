import type { Instant } from '../domain/types.js'
import type { Database } from './database.js'
import { write, type Written } from './write.js'
import type { Refusal } from '../domain/refusal.js'

/**
 * How long an ended session is kept. Tasks are never deleted: the signed-off
 * ones make up the History view.
 */
export const SESSION_RETENTION_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export interface Retained {
  /** False when a process already ran retention on this UTC day. */
  ran: boolean
  sessions: number
}

/**
 * Deletes the sessions that ended more than 7 days ago, once a UTC day. The
 * check of the day and the deletion share one write transaction, so two
 * processes opening together run it once. The revision moves only when a row
 * was deleted.
 *
 * A session a task still names, as its assignment or the worker it goes back
 * to, is kept: the foreign keys would refuse its deletion.
 */
export function runRetention(database: Database, now: Instant): Written<Retained> | Refusal {
  const today = now.slice(0, 10)
  const cutoff = new Date(Date.parse(now) - SESSION_RETENTION_DAYS * DAY_MS).toISOString()
  return write(
    database,
    (sqlite): Retained => {
      const { retained_on: retainedOn } = sqlite
        .prepare('SELECT retained_on FROM board WHERE id = 1')
        .get() as { retained_on: string | null }
      if (retainedOn === today) return { ran: false, sessions: 0 }

      const { changes } = sqlite
        .prepare(
          `DELETE FROM sessions
           WHERE ended_at IS NOT NULL AND ended_at < ?
             AND id NOT IN (SELECT assigned_to FROM tasks WHERE assigned_to IS NOT NULL)
             AND id NOT IN (SELECT resume_with FROM tasks WHERE resume_with IS NOT NULL)`
        )
        .run(cutoff)
      sqlite.prepare('UPDATE board SET retained_on = ? WHERE id = 1').run(today)
      return { ran: true, sessions: Number(changes) }
    },
    { keepRevision: (retained) => retained.sessions === 0 }
  )
}
