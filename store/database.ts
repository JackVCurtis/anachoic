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
}

export interface OpenOptions {
  busyTimeoutMs?: number
  writeHooks?: WriteHook[]
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

const SQLITE_BUSY = 5

/**
 * SQLITE_BUSY, or one of its extended codes, which share its low byte.
 */
export function isBusy(error: unknown): boolean {
  const errcode = (error as { errcode?: unknown } | null)?.errcode
  return typeof errcode === 'number' && (errcode & 0xff) === SQLITE_BUSY
}

function pause(milliseconds: number) {
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
 * Opens the database at `file`, sets the pragmas every connection needs, and
 * migrates it. The caller resolves the path; the store never reads the
 * environment.
 */
export function openDatabase(file: string, options: OpenOptions = {}): Database {
  const sqlite = new DatabaseSync(file)
  let applied: number
  try {
    const busyTimeoutMs = Math.trunc(options.busyTimeoutMs ?? BUSY_TIMEOUT_MS)
    sqlite.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`)
    useWal(sqlite, busyTimeoutMs)
    sqlite.exec('PRAGMA synchronous = NORMAL')
    sqlite.exec('PRAGMA foreign_keys = ON')
    applied = migrate(sqlite, file)
  } catch (error) {
    sqlite.close()
    throw error
  }
  return { sqlite, file, writeHooks: [...(options.writeHooks ?? [])], applied }
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
