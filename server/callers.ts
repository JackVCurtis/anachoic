import { randomUUID } from 'node:crypto'
import { isRefusal, type Refusal } from '../domain/refusal.js'
import type { Instant, SessionKind } from '../domain/types.js'
import type { Database } from '../store/database.js'
import type { Heartbeat } from '../store/heartbeat.js'
import { touchKnownSession, touchSession, type Touched } from '../store/sessions.js'
import type { Written } from '../store/write.js'
import { resolveIdentity, type ClientInfo, type IdentityEnvironment } from './identity.js'
import type { Logger } from './logger.js'

/**
 * The session a tool call comes from, after its row was touched.
 */
export interface Caller {
  id: string
  kind: SessionKind
  name: string
  /** The id was minted by this server, so the model must pass it as session. */
  minted: boolean
}

export interface Callers {
  /**
   * Resolves the session a call comes from, creates or touches its row, and
   * has this process's heartbeat serve it from then on.
   */
  enter(client: ClientInfo | undefined, sessionArg?: string): Caller | Refusal
}

export interface CallersOptions {
  database: Database
  heartbeat: Pick<Heartbeat, 'serve'>
  env: IdentityEnvironment
  logger: Logger
  now?: () => Instant
  pid?: number
  mint?: () => string
}

/**
 * One per process. A process that cannot name its session from its client
 * mints one id, on its first tool call, and uses it for every call that does
 * not name a session; a first call that names one makes that the process's
 * session instead.
 */
export function createCallers({
  database,
  heartbeat,
  env,
  logger,
  now = () => new Date().toISOString(),
  pid = process.pid,
  mint = randomUUID,
}: CallersOptions): Callers {
  let own: string | undefined
  const served = new Set<string>()

  function touched(
    result: Written<Touched> | Refusal,
    source: string,
    minted: boolean
  ): Caller | Refusal {
    if (isRefusal(result)) return result
    const { session } = result.value
    heartbeat.serve(session.id)
    logger.setSessionId(session.id)
    if (!served.has(session.id)) {
      served.add(session.id)
      logger.log('session', { id: session.id, kind: session.kind, source })
    }
    return { id: session.id, kind: session.kind, name: session.name, minted }
  }

  return {
    enter(client, sessionArg) {
      const resolution = resolveIdentity(client, env, sessionArg)
      switch (resolution.source) {
        case 'client':
          return touched(touchSession(database, resolution.identity, now(), pid), 'client', false)
        case 'session': {
          const result = touched(
            touchKnownSession(database, resolution.id, now(), pid),
            'session',
            true
          )
          if (!isRefusal(result)) own ??= result.id
          return result
        }
        case 'mint': {
          own ??= mint()
          return touched(
            touchSession(database, { id: own, kind: 'worker', projectDir: null }, now(), pid),
            'mint',
            true
          )
        }
      }
    },
  }
}
