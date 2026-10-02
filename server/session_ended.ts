import { join } from 'node:path'
import { isRefusal } from '../domain/refusal.js'
import { closeDatabase, openDatabase } from '../store/database.js'
import { removeSession } from '../store/sessions.js'
import {
  prepareDataDirectory,
  resolveDataDirectory,
  type DataDirectorySources,
} from './data_directory.js'
import { createLogger, describeError, type Logger } from './logger.js'

/**
 * How long the hook waits for its JSON on stdin. Claude Code gives every
 * SessionEnd hook 1.5 s together, so the whole run must fit well inside it.
 */
export const STDIN_TIMEOUT_MS = 500

/**
 * Reads a stream to its end, or for at most `timeoutMs`, as text.
 */
export function readInput(
  stream: NodeJS.ReadableStream,
  timeoutMs = STDIN_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve) => {
    let text = ''
    const done = () => {
      clearTimeout(timer)
      stream.removeAllListeners('data')
      resolve(text)
    }
    const timer = setTimeout(done, timeoutMs)
    stream.setEncoding?.('utf8')
    stream.on('data', (chunk: string) => (text += chunk))
    stream.once('end', done)
    stream.once('error', done)
  })
}

/**
 * The session id in a SessionEnd hook's JSON, or why there is none. The
 * reason never quotes the input, which may carry paths and prompts.
 */
export function sessionIdOf(text: string): { id: string } | { failure: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { failure: 'stdin is not JSON' }
  }
  const id = (parsed as { session_id?: unknown } | null)?.session_id
  if (typeof id !== 'string' || id.trim() === '') {
    return { failure: 'the hook JSON has no session_id' }
  }
  return { id }
}

export interface SessionEndedOptions extends DataDirectorySources {
  input: string
  now?: () => string
  writeStderr?: (line: string) => void
}

/**
 * The --session-ended mode, for a SessionEnd hook: ends and removes the
 * session the hook names, in one short write, and logs the outcome with the
 * session id alone. It speaks no MCP and never throws, so the hook always
 * exits 0 and never disturbs the session that is ending.
 */
export function sessionEnded({
  input,
  now = () => new Date().toISOString(),
  writeStderr = (line) => process.stderr.write(line),
  ...sources
}: SessionEndedOptions): void {
  const resolution = resolveDataDirectory(sources)
  if (!resolution.ok) {
    writeStderr(`Anachoic MCP session-ended: ${resolution.reason}\n`)
    return
  }
  let logger: Logger
  try {
    const { logs } = prepareDataDirectory(resolution.directory)
    logger = createLogger({ logsDirectory: logs, writeStderr })
  } catch (error) {
    writeStderr(`Anachoic MCP session-ended: ${(error as Error).message}\n`)
    return
  }

  const found = sessionIdOf(input)
  if ('failure' in found) {
    logger.log('session_ended_failed', { reason: found.failure })
    return
  }
  logger.setSessionId(found.id)
  try {
    const database = openDatabase(join(resolution.directory, 'board.sqlite'))
    try {
      const result = removeSession(database, found.id, now())
      if (isRefusal(result)) {
        logger.log('session_ended_refused', { code: result.code, sentence: result.sentence })
      } else {
        logger.log('session_ended', {
          removed: result.value.removed,
          tasks: result.value.tasks,
        })
      }
    } finally {
      closeDatabase(database)
    }
  } catch (error) {
    logger.log('session_ended_failed', describeError(error))
  }
}
