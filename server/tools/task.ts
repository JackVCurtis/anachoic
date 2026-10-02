import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { archived, invalid, isRefusal, notFound, type Refusal } from '../../domain/refusal.js'
import { getTaskResultSchema, taskPropsSchema, type GetTaskResult } from '../../shared/props.js'
import { InvalidTaskIdError, toTaskNumber } from '../../shared/task_id.js'
import { readRevision, readTask, type TaskSnapshot } from '../../store/queries.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { taskProps } from '../props/task.js'
import { refusalResult } from '../results.js'
import { blockHistory } from '../text/model_tools.js'
import { openTaskText } from '../text/open_task.js'
import { asCaller, asTool, type ToolContext } from './context.js'
import { taskInput } from './inputs.js'
import { sessionInput } from './session_input.js'

function taskNumber(task: string | number): number | Refusal {
  try {
    return toTaskNumber(task)
  } catch (error) {
    if (error instanceof InvalidTaskIdError) {
      return invalid(`task must be a task id such as T-012, not “${task}”`)
    }
    throw error
  }
}

/**
 * open_task, which the model calls to draw one task in the task view, and
 * get_task, which only the views call, to fetch a task on connect and to
 * poll it.
 */
export function registerTaskTools(server: McpServer, context: ToolContext) {
  const { database, now } = context

  /** The task as it is now, or the refusal for a missing one. */
  function snapshotOf(task: string | number): TaskSnapshot | Refusal {
    const id = taskNumber(task)
    if (isRefusal(id)) return id
    return readTask(database, id) ?? notFound(id)
  }

  const openTask = registerAppTool(
    server,
    'open_task',
    {
      title: 'Open a task',
      description: TOOL_DESCRIPTIONS.worker.open_task,
      inputSchema: z.object({ task: taskInput, ...sessionInput }),
      outputSchema: taskPropsSchema,
      _meta: { ui: { resourceUri: context.views.task } },
    },
    asCaller(context, 'open_task', ({ task }) => {
      const snapshot = snapshotOf(task)
      if (isRefusal(snapshot)) return refusalResult(snapshot)
      const at = now()
      const props = taskProps(snapshot, at)
      return {
        content: [{ type: 'text', text: openTaskText(props, blockHistory(snapshot.events, at)) }],
        structuredContent: props,
      }
    })
  )

  registerAppTool(
    server,
    'get_task',
    {
      title: 'Get a task',
      description:
        'Returns the task props, or {changed: false} when the board is still at sinceRevision. For the task view and the board’s task panel only.',
      inputSchema: z.object({
        task: taskInput,
        sinceRevision: z.number().int().nonnegative().optional(),
      }),
      outputSchema: getTaskResultSchema,
      _meta: { ui: { visibility: ['app'] } },
    },
    asTool(context, 'get_task', ({ task, sinceRevision }) => {
      const id = taskNumber(task)
      if (isRefusal(id)) return refusalResult(id)
      if (sinceRevision !== undefined) {
        const revision = readRevision(database)
        if (sinceRevision === revision) {
          const unchanged: GetTaskResult = { changed: false, revision }
          return {
            content: [{ type: 'text', text: `Board, revision ${revision}, unchanged` }],
            structuredContent: unchanged,
          }
        }
      }
      const snapshot = readTask(database, id)
      if (!snapshot) return refusalResult(notFound(id))
      if (snapshot.state.task.archivedAt !== null) return refusalResult(archived(id))
      const props = taskProps(snapshot, now())
      return {
        content: [{ type: 'text', text: `${props.task.displayId}, revision ${props.revision}` }],
        structuredContent: props,
      }
    })
  )

  return { open_task: openTask }
}
