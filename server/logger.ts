import { appendFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Fields that may carry what you or an agent wrote. They are cut short so the
 * log never holds them in full.
 */
const TRUNCATED_FIELDS = new Set(['question', 'answer', 'note'])
const TRUNCATED_LENGTH = 80

export type LogFields = Record<string, unknown>

export type Logger = {
  log(event: string, fields?: LogFields): void
  setSessionId(sessionId: string | undefined): void
}

type LoggerOptions = {
  logsDirectory: string
  writeStderr?: (line: string) => void
  now?: () => Date
}

function truncate(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) =>
      TRUNCATED_FIELDS.has(key) && typeof value === 'string' && value.length > TRUNCATED_LENGTH
        ? [key, `${value.slice(0, TRUNCATED_LENGTH)}…`]
        : [key, value]
    )
  )
}

/**
 * Writes one JSON line per event to stderr and to the day's file in logs/.
 * Writes are synchronous so the last lines survive an immediate exit. The
 * logger is never given the environment, and callers never pass it.
 */
export function createLogger({
  logsDirectory,
  writeStderr = (line) => process.stderr.write(line),
  now = () => new Date(),
}: LoggerOptions): Logger {
  let sessionId: string | undefined

  return {
    setSessionId(id) {
      sessionId = id
    },
    log(event, fields = {}) {
      const time = now().toISOString()
      const entry = {
        time,
        pid: process.pid,
        ...(sessionId ? { sessionId } : {}),
        event,
        ...truncate(fields),
      }
      const line = `${JSON.stringify(entry)}\n`
      writeStderr(line)
      try {
        appendFileSync(join(logsDirectory, `server-${time.slice(0, 10)}.log`), line, {
          mode: 0o600,
        })
      } catch (error) {
        writeStderr(
          `${JSON.stringify({ time, pid: process.pid, event: 'log_write_failed', message: (error as Error).message })}\n`
        )
      }
    },
  }
}

export function describeError(error: unknown) {
  return error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) }
}
