import type {
  ActionResult,
  BoardProps,
  GetBoardResult,
  GetHistoryResult,
  GetTaskResult,
  OutputFormat,
} from '../../shared/props'
import type { HostApp } from './connect'

/**
 * What an app-only tool call came to: the props it returned, the sentence of
 * a refusal, or no answer at all.
 */
export type ToolOutcome<Props> =
  { ok: true; props: Props } | { ok: false; refusal: string } | { ok: false; unreachable: true }

function textOf(content: ReadonlyArray<{ type: string; text?: string }> | undefined) {
  return (content ?? [])
    .flatMap((block) => (block.type === 'text' && block.text ? [block.text] : []))
    .join('\n')
}

/**
 * Calls an app-only tool. The server shapes structuredContent by the tool's
 * output schema, so it is taken as the props. A result without it is treated
 * as no answer, as is a call that throws.
 */
export async function callAppTool<Props>(
  app: Pick<HostApp, 'callServerTool'>,
  name: string,
  args: Record<string, unknown>
): Promise<ToolOutcome<Props>> {
  let result
  try {
    result = await app.callServerTool({ name, arguments: args })
  } catch {
    return { ok: false, unreachable: true }
  }
  if (result.isError) {
    return { ok: false, refusal: textOf(result.content) }
  }
  if (result.structuredContent === undefined) {
    return { ok: false, unreachable: true }
  }
  return { ok: true, props: result.structuredContent as Props }
}

/**
 * The board, or that it is still at sinceRevision.
 */
export function getBoard(app: Pick<HostApp, 'callServerTool'>, sinceRevision?: number) {
  return callAppTool<GetBoardResult>(
    app,
    'get_board',
    sinceRevision === undefined ? {} : { sinceRevision }
  )
}

type App = Pick<HostApp, 'callServerTool'>

/** A task as the app-only tools take it: its display id or its number. */
export type TaskArg = string | number

/**
 * One task in full, or that the board is still at sinceRevision, or the
 * refusal's sentence, such as "T-012 was archived".
 */
export function getTask(app: App, task: TaskArg, sinceRevision?: number) {
  return callAppTool<GetTaskResult>(
    app,
    'get_task',
    sinceRevision === undefined ? { task } : { task, sinceRevision }
  )
}

/**
 * One page of the history, from 1, matching the filter when there is one,
 * or that the board is still at sinceRevision. A page past the end gives
 * the last page.
 */
export function getHistory(app: App, page: number, filter?: string, sinceRevision?: number) {
  return callAppTool<GetHistoryResult>(app, 'get_history', {
    page,
    ...(filter ? { filter } : {}),
    ...(sinceRevision === undefined ? {} : { sinceRevision }),
  })
}

export interface NewStep {
  title: string
  owner: 'agent' | 'you'
  detail?: string
  /** Agent steps only. */
  outputFormat?: OutputFormat | null
}

/**
 * Your actions. Each resolves to the fresh board and the task acted on, which the view
 * draws at once, or to the refusal's sentence.
 */
export const actions = {
  addTask: (
    app: App,
    input: { title: string; steps: NewStep[]; queue: boolean; assignTo?: string }
  ) => callAppTool<ActionResult>(app, 'add_task_from_view', { ...input }),
  queueTask: (app: App, task: TaskArg) =>
    callAppTool<ActionResult>(app, 'queue_task_from_view', { task }),
  reorderQueue: (app: App, task: TaskArg, position: number) =>
    callAppTool<ActionResult>(app, 'reorder_queue', { task, position }),
  moveToBacklog: (app: App, task: TaskArg) =>
    callAppTool<ActionResult>(app, 'move_to_backlog', { task }),
  completeMyStep: (app: App, task: TaskArg, note?: string) =>
    callAppTool<ActionResult>(app, 'complete_my_step', { task, ...(note ? { note } : {}) }),
  answerQuestion: (app: App, task: TaskArg, answer: string) =>
    callAppTool<ActionResult>(app, 'answer_question', { task, answer }),
  signOff: (app: App, task: TaskArg) => callAppTool<ActionResult>(app, 'sign_off', { task }),
  addFollowUp: (
    app: App,
    task: TaskArg,
    input: { steps: NewStep[]; placement: 'first' | 'last' }
  ) => callAppTool<ActionResult>(app, 'add_follow_up_from_view', { task, ...input }),
  archiveTask: (app: App, task: TaskArg) =>
    callAppTool<ActionResult>(app, 'archive_task', { task }),
  removeSession: (app: App, session: string) =>
    callAppTool<BoardProps>(app, 'remove_session', { session }),
}

/**
 * Asks the host to open a web address in the browser, since the sandboxed
 * view cannot navigate. False when the host refused or could not be reached.
 */
export async function openLink(app: Pick<HostApp, 'openLink'>, url: string): Promise<boolean> {
  try {
    const result = await app.openLink({ url })
    return !('isError' in result && result.isError)
  } catch {
    return false
  }
}

/**
 * Asks the host to show the view inline or in full screen. Resolves to the
 * mode the host chose, or null when it could not be reached.
 */
export async function requestDisplayMode(
  app: Pick<HostApp, 'requestDisplayMode'>,
  mode: 'inline' | 'fullscreen'
): Promise<string | null> {
  try {
    const result = await app.requestDisplayMode({ mode })
    return result.mode
  } catch {
    return null
  }
}
