import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { invalid, isRefusal } from '../../domain/refusal.js'
import { YOU } from '../../domain/types.js'
import { LIMITS } from '../../shared/limits.js'
import { actionResultSchema, boardPropsSchema, type ActionResult } from '../../shared/props.js'
import {
  addFollowUp,
  addTask,
  answerQuestion,
  archiveTask,
  completeMyStep,
  moveToBacklog,
  queueTask,
  rejectStep,
  reorderQueue,
  signOff,
  type Acted,
  type ServiceResult,
} from '../../store/services.js'
import { removeSession } from '../../store/sessions.js'
import { readBoardProps, taskRef } from '../props/board.js'
import { refusalResult } from '../results.js'
import { formatTaskId } from '../../shared/task_id.js'
import { viewActionText } from '../text/view_actions.js'
import { asTool, type ToolContext } from './context.js'
import {
  formResponsesInput,
  fromViewSteps,
  taskInput,
  titleInput,
  viewStepsInput,
} from './inputs.js'

export const VIEW_ACTION_TOOLS = [
  'add_task_from_view',
  'queue_task_from_view',
  'reorder_queue',
  'move_to_backlog',
  'complete_my_step',
  'answer_question',
  'sign_off',
  'add_follow_up_from_view',
  'archive_task',
  'reject_step',
] as const

export type ViewActionTool = (typeof VIEW_ACTION_TOOLS)[number]

/**
 * Your actions, which only the view calls. Each acts as you, never as the
 * session of the client it arrives on, and returns the fresh board props so
 * the view redraws from the result.
 */
export function registerViewActions(server: McpServer, context: ToolContext) {
  const { database, now } = context

  function register<Shape extends z.ZodRawShape>(
    name: ViewActionTool,
    title: string,
    description: string,
    input: Shape,
    act: (args: z.infer<z.ZodObject<Shape>>, at: string) => ServiceResult,
    text: (
      acted: Acted,
      args: z.infer<z.ZodObject<Shape>>,
      nameOf: (id: string) => string
    ) => string
  ) {
    return registerAppTool(
      server,
      name,
      {
        title,
        description: `${description} For the board view only.`,
        inputSchema: z.object(input),
        outputSchema: actionResultSchema,
        _meta: { ui: { visibility: ['app'] } },
      },
      asTool(context, name, (args: z.infer<z.ZodObject<Shape>>): CallToolResult => {
        const at = now()
        const result = act(args, at)
        if (isRefusal(result)) return refusalResult(result)
        const { task } = result.value.state
        const board = readBoardProps(database, at)
        const names = new Map(board.sessions.map((session) => [session.id, session.name]))
        const nameOf = (id: string) => names.get(id) ?? id
        const structured: ActionResult = {
          ...board,
          acted: {
            task: taskRef(task, nameOf),
            status: task.status,
            position: task.queuePosition,
          },
        }
        return {
          content: [{ type: 'text', text: text(result.value, args, nameOf) }],
          structuredContent: structured,
        }
      })
    )
  }

  registerAppTool(
    server,
    'remove_session',
    {
      title: 'Remove a session',
      description:
        'Ends and removes a worker session: its claims go back to the queue and its assignments are cleared. For the board view only.',
      inputSchema: z.object({ session: z.string().min(1).max(100) }),
      outputSchema: boardPropsSchema,
      _meta: { ui: { visibility: ['app'] } },
    },
    asTool(context, 'remove_session', ({ session }): CallToolResult => {
      const at = now()
      const result = removeSession(database, session, at)
      if (isRefusal(result)) return refusalResult(result)
      const { session: removed, tasks } = result.value
      const released = tasks.length === 0 ? '' : `, from ${tasks.map(formatTaskId).join(', ')}`
      return {
        content: [{ type: 'text', text: `Removed ${removed.name}${released}` }],
        structuredContent: readBoardProps(database, at),
      }
    })
  )

  const task = { task: taskInput }

  return {
    add_task_from_view: register(
      'add_task_from_view',
      'Add a task',
      'Adds a task the user created, to the queue or the backlog, assigned to the live worker whose session id is assignTo when given.',
      {
        title: titleInput,
        steps: viewStepsInput,
        queue: z.boolean().default(true),
        assignTo: z.string().min(1).max(100).optional(),
      },
      ({ title, steps, queue, assignTo }, at) =>
        addTask(database, YOU, at, { title, steps: fromViewSteps(steps), queue, assignTo }),
      ({ state }) => viewActionText.addTask(state)
    ),
    queue_task_from_view: register(
      'queue_task_from_view',
      'Queue a task',
      'Queues a backlog task, assigned afresh to the live worker whose session id is assignTo, or to any worker when assignTo is null.',
      { ...task, assignTo: z.string().min(1).max(100).nullable().optional() },
      ({ task: ref, assignTo }, at) => queueTask(database, YOU, at, ref, assignTo),
      ({ state }) => viewActionText.queueTask(state)
    ),
    reorder_queue: register(
      'reorder_queue',
      'Reorder the queue',
      'Moves a queued task to a position in the queue.',
      { ...task, position: z.number().int().positive() },
      ({ task: ref, position }, at) => reorderQueue(database, YOU, at, ref, position),
      ({ state }) => viewActionText.reorderQueue(state)
    ),
    move_to_backlog: register(
      'move_to_backlog',
      'Move to the backlog',
      'Parks an active task, or moves a queued task back to the backlog.',
      task,
      ({ task: ref }, at) => moveToBacklog(database, YOU, at, ref),
      ({ state, events }) => viewActionText.moveToBacklog(state, events)
    ),
    complete_my_step: register(
      'complete_my_step',
      'Mark a user step done',
      'Marks the user’s waiting step done, with an optional note.',
      { ...task, note: z.string().max(LIMITS.note.max).optional() },
      ({ task: ref, note }, at) => completeMyStep(database, YOU, at, ref, { note }),
      ({ state, events }) => viewActionText.completeMyStep(state, events)
    ),
    answer_question: register(
      'answer_question',
      'Answer a form',
      'Answers the form an agent’s step waits on: with responses that walk it to an end, or with direct, the user’s own words instead.',
      {
        ...task,
        responses: formResponsesInput.optional(),
        direct: z.string().min(LIMITS.answer.min).max(LIMITS.answer.max).optional(),
      },
      ({ task: ref, responses, direct }, at) => {
        if ((responses === undefined) === (direct === undefined)) {
          return invalid('Answer with either responses or direct')
        }
        return answerQuestion(
          database,
          YOU,
          at,
          ref,
          direct === undefined ? { responses: responses ?? [] } : { direct }
        )
      },
      ({ state }) => viewActionText.answerQuestion(state)
    ),
    sign_off: register(
      'sign_off',
      'Sign off a task',
      'Signs off a done task.',
      task,
      ({ task: ref }, at) => signOff(database, YOU, at, ref),
      ({ state }) => viewActionText.signOff(state)
    ),
    add_follow_up_from_view: register(
      'add_follow_up_from_view',
      'Add follow-up steps',
      'Adds follow-up steps to a done task.',
      { ...task, steps: viewStepsInput, placement: z.enum(['first', 'last']) },
      ({ task: ref, steps, placement }, at) =>
        addFollowUp(database, YOU, at, ref, { steps: fromViewSteps(steps), placement }),
      ({ state }, { steps }) => viewActionText.addFollowUp(state, steps.length)
    ),
    archive_task: register(
      'archive_task',
      'Archive a task',
      'Archives a task that is not signed off.',
      task,
      ({ task: ref }, at) => archiveTask(database, YOU, at, ref),
      ({ state }) => viewActionText.archiveTask(state)
    ),
    reject_step: register(
      'reject_step',
      'Reject a step',
      'Sends the agent step whose output waits on the user back to the queue, with the user’s note on what was wrong, preferring the worker that did it.',
      { ...task, note: z.string().min(LIMITS.rejection.min).max(LIMITS.rejection.max) },
      ({ task: ref, note }, at) => rejectStep(database, YOU, at, ref, note),
      ({ state, events }, _args, nameOf) =>
        viewActionText.rejectStep(
          state,
          events,
          state.task.resumeWith === null ? undefined : nameOf(state.task.resumeWith)
        )
    ),
  }
}
