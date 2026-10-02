import type { DatabaseSync } from 'node:sqlite'
import { BUSY, isRefusal, type Refusal } from '../domain/refusal.js'
import { isBusy, type Database } from './database.js'

export interface Written<T> {
  value: T
  revision: number
}

export interface WriteOptions {
  /**
   * Leaves the revision as it was unless a write hook changed the board. Only
   * the plain heartbeat writes this way, because the board does not show it.
   */
  keepRevision?: boolean
}

function isThenable(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function rollback(sqlite: DatabaseSync) {
  if (sqlite.isTransaction) sqlite.exec('ROLLBACK')
}

function readRevision(sqlite: DatabaseSync): number {
  return (sqlite.prepare('SELECT revision FROM board WHERE id = 1').get() as { revision: number })
    .revision
}

/**
 * Runs `change` as one short transaction under the write lock: BEGIN
 * IMMEDIATE, the write hooks, the change, one more on board.revision, and
 * COMMIT. A change that returns a refusal, or throws, is rolled back. The
 * write lock held past the busy timeout is the busy refusal, with nothing
 * changed.
 *
 * The change must be synchronous: no transaction is held across an await.
 */
export function write<T>(
  database: Database,
  change: (sqlite: DatabaseSync) => T | Refusal,
  options: WriteOptions = {}
): Written<T> | Refusal {
  const { sqlite } = database
  try {
    sqlite.exec('BEGIN IMMEDIATE')
  } catch (error) {
    if (isBusy(error)) return BUSY
    throw error
  }

  let value: T
  try {
    let hooked = false
    for (const hook of database.writeHooks) {
      if (hook(sqlite)) hooked = true
    }
    const result = change(sqlite)
    if (isThenable(result)) {
      throw new TypeError('A write must be synchronous; its change returned a promise')
    }
    if (isRefusal(result)) {
      rollback(sqlite)
      return result
    }
    value = result
    if (!options.keepRevision || hooked) {
      sqlite.prepare('UPDATE board SET revision = revision + 1 WHERE id = 1').run()
    }
  } catch (error) {
    rollback(sqlite)
    throw error
  }

  const revision = readRevision(sqlite)
  try {
    sqlite.exec('COMMIT')
  } catch (error) {
    rollback(sqlite)
    if (isBusy(error)) return BUSY
    throw error
  }
  return { value, revision }
}

export function isWritten<T>(result: Written<T> | Refusal): result is Written<T> {
  return !isRefusal(result)
}
