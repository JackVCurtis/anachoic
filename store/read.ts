import type { DatabaseSync } from 'node:sqlite'
import type { Database } from './database.js'

/**
 * Runs `query` inside a deferred BEGIN, so it sees one consistent snapshot. A
 * reader never takes the write lock, and never waits for a writer.
 */
export function read<T>(database: Database, query: (sqlite: DatabaseSync) => T): T {
  const { sqlite } = database
  sqlite.exec('BEGIN')
  try {
    const result = query(sqlite)
    if (
      typeof result === 'object' &&
      result !== null &&
      typeof (result as { then?: unknown }).then === 'function'
    ) {
      throw new TypeError('A read must be synchronous; its query returned a promise')
    }
    sqlite.exec('COMMIT')
    return result
  } catch (error) {
    if (sqlite.isTransaction) sqlite.exec('ROLLBACK')
    throw error
  }
}
