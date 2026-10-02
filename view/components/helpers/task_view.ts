// Copied from anachoic inertia/components/helpers/task_drawer.ts at fd99e0d
import { taskView } from './strings'

/**
 * The list a task belongs to. A task whose agent step waits on you is in
 * `yourTurn`, though a session still holds that step.
 */
export type TaskList = 'working' | 'yourTurn' | 'toSignOff' | 'signedOff' | 'queue' | 'backlog'

export type BadgeLook = 'accent' | 'neutral'

export type Badge = {
  label: string
  look: BadgeLook
}

const BADGES: Readonly<Record<TaskList, Badge>> = {
  working: { label: taskView.badgeRunning, look: 'accent' },
  yourTurn: { label: taskView.badgeYourTurn, look: 'accent' },
  toSignOff: { label: taskView.badgeToSignOff, look: 'accent' },
  signedOff: { label: taskView.badgeDone, look: 'accent' },
  queue: { label: taskView.badgeQueue, look: 'neutral' },
  backlog: { label: taskView.badgeBacklog, look: 'neutral' },
}

/**
 * The task view's status badge for the list a task belongs to.
 */
export function badgeFor(list: TaskList): Badge {
  return BADGES[list]
}
