import { DEAD_WINDOW_MS } from '../domain/derived.js'
import type { Instant } from '../domain/types.js'
import type { Database } from './database.js'
import { registerLiveness } from './sessions.js'
import { write } from './write.js'

export const HEARTBEAT_INTERVAL_MS = 30 * 1000

export interface HeartbeatOptions {
  intervalMs?: number
  deadWindowMs?: number
  now?: () => Instant
  pid?: number
  onError?: (error: unknown) => void
}

export interface Heartbeat {
  /**
   * Adds a session this process serves; every later beat refreshes it.
   */
  serve(sessionId: string): void
  /**
   * One beat now: refreshes lastSeenAt and pid on every session served.
   */
  beat(): void
  stop(): void
  readonly served: ReadonlySet<string>
}

/**
 * Started once per process. Every interval it marks the sessions this
 * process serves as seen, in one short write that keeps the board revision
 * unless it ended a dead session. It also registers the release of dead
 * sessions on every write, which never ends a session served here.
 */
export function startHeartbeat(database: Database, options: HeartbeatOptions = {}): Heartbeat {
  const now = options.now ?? (() => new Date().toISOString())
  const pid = options.pid ?? process.pid
  const served = new Set<string>()
  registerLiveness(database, {
    now,
    deadWindowMs: options.deadWindowMs ?? DEAD_WINDOW_MS,
    servedHere: (id) => served.has(id),
  })

  const beat = () => {
    if (served.size === 0) return
    const ids = [...served]
    write(
      database,
      (sqlite) => {
        const update = sqlite.prepare('UPDATE sessions SET last_seen_at = ?, pid = ? WHERE id = ?')
        const at = now()
        for (const id of ids) update.run(at, pid, id)
        return null
      },
      { keepRevision: true }
    )
  }

  const timer = setInterval(() => {
    try {
      beat()
    } catch (error) {
      options.onError?.(error)
    }
  }, options.intervalMs ?? HEARTBEAT_INTERVAL_MS)
  timer.unref()

  return {
    serve: (sessionId) => void served.add(sessionId),
    beat,
    stop: () => clearInterval(timer),
    served,
  }
}
