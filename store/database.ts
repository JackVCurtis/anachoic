import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS } from './migrations.js'

/**
 * Runs at the start of every write transaction, before the change. It
 * returns true when it changed what the board shows, so a write that would
 * otherwise keep the revision bumps it.
 */
export type WriteHook = (sqlite: DatabaseSync) => boolean

/**
 * One process's connection to the board's database, kept for the process's
 * lifetime.
 */
export interface Database {
  readonly sqlite: DatabaseSync
  readonly file: string
  readonly writeHooks: WriteHook[]
  /**
   * How many migrations this open applied: none when another process, or an
   * earlier open, already had.
   */
  readonly applied: number
  /**
   * For tests only: how long every write that bumps the revision keeps the
   * write lock before it commits, so a test can kill the process holding it.
   */
  readonly holdWriteMs: number
}

export interface OpenOptions {
  busyTimeoutMs?: number
  writeHooks?: WriteHook[]
  holdWriteMs?: number
}

export const BUSY_TIMEOUT_MS = 5000

export class DatabaseTooNewError extends Error {
  name = 'DatabaseTooNewError'

  constructor(
    readonly file: string,
    readonly version: number,
    readonly newest: number
  ) {
    super(
      `The board's database at ${file} is at version ${version}, but this server knows only up to ${newest}. A newer version of the server owns the database.`
    )
  }
}

/**
 * The file cannot be opened, or fails PRAGMA quick_check. The file is left as
 * it is, never replaced.
 */
export class DatabaseUnreadableError extends Error {
  name = 'DatabaseUnreadableError'

  constructor(
    readonly file: string,
    readonly reason: string
  ) {
    super(`The board's database at ${file} can't be read: ${reason}`)
  }
}

const SQLITE_BUSY = 5

/**
 * SQLITE_BUSY, or one of its extended codes, which share its low byte.
 */
export function isBusy(error: unknown): boolean {
  const errcode = (error as { errcode?: unknown } | null)?.errcode
  return typeof errcode === 'number' && (errcode & 0xff) === SQLITE_BUSY
}

export function pause(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

/**
 * Switching a fresh file to WAL needs a lock that SQLite does not wait for
 * through busy_timeout, so a process opening a file another process is
 * creating retries until the timeout.
 */
function useWal(sqlite: DatabaseSync, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      sqlite.exec('PRAGMA journal_mode = WAL')
      return
    } catch (error) {
      if (!isBusy(error) || Date.now() >= deadline) throw error
      pause(5)
    }
  }
}

/**
 * PRAGMA quick_check returns one row, "ok", for a sound file, and otherwise a
 * row per problem it found.
 */
function quickCheck(sqlite: DatabaseSync): string | undefined {
  const rows = sqlite.prepare('PRAGMA quick_check').all() as Array<{ quick_check: string }>
  const problems = rows.map((row) => row.quick_check).filter((result) => result !== 'ok')
  return problems.length === 0 ? undefined : problems.join('; ')
}

function userVersion(sqlite: DatabaseSync): number {
  return (sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
}

/**
 * Applies the migrations the database is missing. The version is read again
 * under the write lock, so two processes that open a fresh file together
 * never run a migration twice.
 */
function migrate(sqlite: DatabaseSync, file: string): number {
  const newest = MIGRATIONS.length
  const found = userVersion(sqlite)
  if (found > newest) throw new DatabaseTooNewError(file, found, newest)
  if (found === newest) return 0

  sqlite.exec('BEGIN IMMEDIATE')
  try {
    const current = userVersion(sqlite)
    if (current > newest) throw new DatabaseTooNewError(file, current, newest)
    for (let version = current + 1; version <= newest; version++) {
      sqlite.exec(MIGRATIONS[version - 1])
    }
    // PRAGMA takes no bound parameters; newest is a whole number from this module.
    sqlite.exec(`PRAGMA user_version = ${newest}`)
    sqlite.exec('COMMIT')
    return newest - current
  } catch (error) {
    if (sqlite.isTransaction) sqlite.exec('ROLLBACK')
    throw error
  }
}

/**
 * Sets the pragmas every connection needs and checks the file. Any failure
 * but a lock timeout means the file cannot be read.
 */
function prepare(sqlite: DatabaseSync, file: string, busyTimeoutMs: number) {
  try {
    sqlite.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`)
    useWal(sqlite, busyTimeoutMs)
    sqlite.exec('PRAGMA synchronous = NORMAL')
    sqlite.exec('PRAGMA foreign_keys = ON')
  } catch (error) {
    if (isBusy(error)) throw error
    throw new DatabaseUnreadableError(file, (error as Error).message)
  }
  let problems: string | undefined
  try {
    problems = quickCheck(sqlite)
  } catch (error) {
    if (isBusy(error)) throw error
    throw new DatabaseUnreadableError(file, (error as Error).message)
  }
  if (problems !== undefined) throw new DatabaseUnreadableError(file, problems)
}

/**
 * Opens the database at `file`, sets the pragmas every connection needs,
 * checks it and migrates it. The caller resolves the path; the store never
 * reads the environment.
 */
export function openDatabase(file: string, options: OpenOptions = {}): Database {
  let sqlite: DatabaseSync
  try {
    sqlite = new DatabaseSync(file)
  } catch (error) {
    throw new DatabaseUnreadableError(file, (error as Error).message)
  }
  let applied: number
  try {
    prepare(sqlite, file, Math.trunc(options.busyTimeoutMs ?? BUSY_TIMEOUT_MS))
    applied = migrate(sqlite, file)
  } catch (error) {
    sqlite.close()
    throw error
  }
  return {
    sqlite,
    file,
    writeHooks: [...(options.writeHooks ?? [])],
    applied,
    holdWriteMs: Math.max(0, Math.trunc(options.holdWriteMs ?? 0)),
  }
}

/**
 * A database that was never opened, for a process whose file cannot be read:
 * it keeps the file's path, and any query on it throws.
 */
export function unopenedDatabase(file: string): Database {
  return {
    sqlite: new DatabaseSync(file, { open: false }),
    file,
    writeHooks: [],
    applied: 0,
    holdWriteMs: 0,
  }
}

/**
 * Registers a hook that runs at the start of every later write.
 */
export function onWrite(database: Database, hook: WriteHook): void {
  database.writeHooks.push(hook)
}

export function closeDatabase(database: Database): void {
  if (database.sqlite.isOpen) database.sqlite.close()
}

export function latestVersion(): number {
  return MIGRATIONS.length
}
