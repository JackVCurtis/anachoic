import initial from './migrations/001_initial.sql'

/**
 * Every migration, in order. A migration's number is its place in this list,
 * from 1, and is what PRAGMA user_version records once it is applied.
 */
export const MIGRATIONS: readonly string[] = [initial]
