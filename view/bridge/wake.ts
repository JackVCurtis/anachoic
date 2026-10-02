import type { ActionResult } from '../../shared/props'
import type { HostApp } from './connect'
import { actions, type NewStep, type ToolOutcome } from './tools'

/**
 * The sentences the view posts to the dedicated session after each of your
 * actions, word for word as 06 lists them. Each names tasks by display id
 * and quotes titles and answers in curly quotes.
 */
export const wakeSentences = {
  finishedStep: (task: string, step: { number: number; title: string }, note?: string) =>
    `I finished step ${step.number} of ${task}, “${step.title}”.${note ? ` Note: ${note}` : ''}`,
  answered: (task: string, stepNumber: number, answer: string) =>
    `I answered step ${stepNumber} of ${task}: “${answer}”`,
  added: (task: string, title: string, queued: boolean) =>
    `I added ${task}, “${title}”, to the ${queued ? 'queue' : 'backlog'}.`,
  moved: (task: string, position: number) =>
    `I moved ${task} to position ${position} in the queue.`,
  queued: (task: string, position: number) => `I queued ${task} at position ${position}.`,
  queuedToYou: (task: string) => `I queued ${task}, and its next step is mine.`,
  movedToBacklog: (task: string) => `I moved ${task} to the backlog.`,
  parked: (task: string) => `I parked ${task} and moved it to the backlog.`,
  signedOff: (task: string) => `I signed off ${task}.`,
  followedUp: (task: string, count: number) =>
    `I added ${count} follow-up ${count === 1 ? 'step' : 'steps'} to ${task}.`,
  archived: (task: string) => `I archived ${task}.`,
}

/**
 * Posts one sentence to the dedicated session as a user turn, which Claude
 * replies to. updateModelContext is never used: desktop accepts it but the
 * model never sees it.
 */
export async function wake(app: Pick<HostApp, 'sendMessage'>, text: string) {
  await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] })
}

type ActionApp = Pick<HostApp, 'callServerTool' | 'sendMessage'>

/** A task as an action names it: its display id, which every sentence shows. */
interface TaskName {
  displayId: string
}

/**
 * Your actions as the board calls them: each calls its app-only tool and,
 * only when the result succeeds, posts its sentence. A refusal or an
 * unreachable server posts nothing. The post is not awaited, so the view
 * draws the result at once, and a failed post leaves the action done.
 */
export function createYourActions(app: ActionApp) {
  async function run(
    call: Promise<ToolOutcome<ActionResult>>,
    sentence: (result: ActionResult) => string
  ) {
    const outcome = await call
    if (outcome.ok) {
      wake(app, sentence(outcome.props)).catch(() => {})
    }
    return outcome
  }

  return {
    addTask: (input: { title: string; steps: NewStep[]; queue: boolean }) =>
      run(actions.addTask(app, input), ({ acted }) =>
        wakeSentences.added(acted.task.displayId, acted.task.title, input.queue)
      ),
    queueTask: (task: TaskName) =>
      run(actions.queueTask(app, task.displayId), ({ acted }) =>
        acted.position === null
          ? wakeSentences.queuedToYou(task.displayId)
          : wakeSentences.queued(task.displayId, acted.position)
      ),
    reorderQueue: (task: TaskName, position: number) =>
      run(actions.reorderQueue(app, task.displayId, position), ({ acted }) =>
        wakeSentences.moved(task.displayId, acted.position ?? position)
      ),
    /** `active`: the task was active, so moving it parks it. */
    moveToBacklog: (task: TaskName, active: boolean) =>
      run(actions.moveToBacklog(app, task.displayId), () =>
        active ? wakeSentences.parked(task.displayId) : wakeSentences.movedToBacklog(task.displayId)
      ),
    completeMyStep: (task: TaskName, step: { number: number; title: string }, note?: string) =>
      run(actions.completeMyStep(app, task.displayId, note), () =>
        wakeSentences.finishedStep(task.displayId, step, note)
      ),
    answerQuestion: (task: TaskName, stepNumber: number, answer: string) =>
      run(actions.answerQuestion(app, task.displayId, answer), () =>
        wakeSentences.answered(task.displayId, stepNumber, answer)
      ),
    signOff: (task: TaskName) =>
      run(actions.signOff(app, task.displayId), () => wakeSentences.signedOff(task.displayId)),
    addFollowUp: (task: TaskName, input: { steps: NewStep[]; placement: 'first' | 'last' }) =>
      run(actions.addFollowUp(app, task.displayId, input), () =>
        wakeSentences.followedUp(task.displayId, input.steps.length)
      ),
    archiveTask: (task: TaskName) =>
      run(actions.archiveTask(app, task.displayId), () => wakeSentences.archived(task.displayId)),
  }
}

export type YourActions = ReturnType<typeof createYourActions>
