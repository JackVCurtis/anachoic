import type { HostApp } from './connect'
import { actions, type FormAnswer, type NewStep } from './tools'

type ActionApp = Pick<HostApp, 'callServerTool'>

/** A task as an action names it: its display id. */
interface TaskName {
  displayId: string
}

/**
 * Your actions as the board calls them: each calls its app-only tool and
 * resolves to the outcome. Nothing is posted to the dedicated chat, which
 * reads the board when it needs to (06, waking the dedicated session).
 */
export function createYourActions(app: ActionApp) {
  return {
    addTask: (input: { title: string; steps: NewStep[]; queue: boolean; assignTo?: string }) =>
      actions.addTask(app, input),
    queueTask: (task: TaskName) => actions.queueTask(app, task.displayId),
    reorderQueue: (task: TaskName, position: number) =>
      actions.reorderQueue(app, task.displayId, position),
    /** `active`: the task was active, so moving it parks it. */
    moveToBacklog: (task: TaskName, _active: boolean) => actions.moveToBacklog(app, task.displayId),
    completeMyStep: (task: TaskName, _step: { number: number; title: string }, note?: string) =>
      actions.completeMyStep(app, task.displayId, note),
    answerQuestion: (task: TaskName, _stepNumber: number, answer: FormAnswer) =>
      actions.answerQuestion(app, task.displayId, answer),
    signOff: (task: TaskName) => actions.signOff(app, task.displayId),
    addFollowUp: (task: TaskName, input: { steps: NewStep[]; placement: 'first' | 'last' }) =>
      actions.addFollowUp(app, task.displayId, input),
    archiveTask: (task: TaskName) => actions.archiveTask(app, task.displayId),
    rejectStep: (task: TaskName, note: string) => actions.rejectStep(app, task.displayId, note),
    removeSession: (sessionId: string) => actions.removeSession(app, sessionId),
  }
}

export type YourActions = ReturnType<typeof createYourActions>
