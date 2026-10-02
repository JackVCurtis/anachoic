// Copied from anachoic inertia/components/helpers/task_drawer.ts at fd99e0d
import { fillTemplate, taskView } from './strings'
import { plural } from './words'

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

/**
 * The step label in the task view's header: "Step 3 of 5" while the task
 * runs, "All 3 steps done" once it is done, and "1 step done" for a finished
 * task of one step.
 */
export function taskStepLabel(done: boolean, current: number, stepCount: number): string {
  if (!done) {
    return fillTemplate(taskView.stepCounter, { n: current, m: stepCount })
  }
  return stepCount === 1 ? taskView.oneDone : fillTemplate(taskView.allDone, { m: stepCount })
}

/**
 * The step counts in the task view's header: "3 agent steps · 2 for the user".
 */
export function taskStepCounts(agentSteps: number, userSteps: number): string {
  return fillTemplate(taskView.meta, {
    'a agent steps': plural(agentSteps, 'agent step'),
    'h': userSteps,
  })
}
