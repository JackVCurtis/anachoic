import initial from './migrations/001_initial.sql'
import taskAssignment from './migrations/002_task_assignment.sql'
import outputFormats from './migrations/003_output_formats.sql'
import resumeWith from './migrations/004_resume_with.sql'
import blockedSteps from './migrations/005_blocked_steps.sql'
import removedSessions from './migrations/006_removed_sessions.sql'

/**
 * Every migration, in order. A migration's number is its place in this list,
 * from 1, and is what PRAGMA user_version records once it is applied.
 */
export const MIGRATIONS: readonly string[] = [
  initial,
  taskAssignment,
  outputFormats,
  resumeWith,
  blockedSteps,
  removedSessions,
]
