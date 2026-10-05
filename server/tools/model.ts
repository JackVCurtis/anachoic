import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { invalid, isRefusal } from '../../domain/refusal.js'
import {
  addFollowUp,
  addTask,
  askYou,
  blockStep,
  claimStep,
  completeStep,
  queueTask,
  unblockStep,
  updateStep,
  type ServiceResult,
} from '../../store/services.js'
import { readTask } from '../../store/queries.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { refusalResult, textResult } from '../results.js'
import {
  addFollowUpText,
  addTaskText,
  askYouText,
  blockHistory,
  blockStepText,
  claimStepText,
  completeStepText,
  queueTaskText,
  unblockStepText,
  updateStepText,
} from '../text/model_tools.js'
import { asCaller, type ToolContext } from './context.js'
import {
  artifactUrlInput,
  assignToInput,
  fromModelSteps,
  linksInput,
  noteInput,
  formInput,
  reasonInput,
  stepsInput,
  summaryInput,
  taskInput,
  titleInput,
} from './inputs.js'
import { sessionInput } from './session_input.js'
import { resolveWorker } from './workers.js'

/**
 * The result of a service as a model tool returns it: the text built from
 * what it did, or the refusal's sentence as an error. No structured content.
 */
function answer<T>(result: ServiceResult<T>, text: (value: T) => string) {
  return isRefusal(result) ? refusalResult(result) : textResult(text(result.value))
}

/**
 * The dedicated session is a conversation with the user, so it asks in its
 * own chat: an answer given on the board would never reach it.
 */
export const DEDICATED_ASK = 'Ask in this chat instead'

export const MODEL_TOOLS = [
  'add_task',
  'queue_task',
  'add_follow_up',
  'claim_step',
  'update_step',
  'ask_you',
  'complete_step',
  'block_step',
  'unblock_step',
] as const

export type ModelTool = (typeof MODEL_TOOLS)[number]

/**
 * The tools every session uses to change the board, and the worker tools
 * that act on a step the caller claimed. Each resolves the calling session
 * from its client, never from what the model says.
 */
export function registerModelTools(server: McpServer, context: ToolContext) {
  const { database, now } = context

  return {
    add_task: server.registerTool(
      'add_task',
      {
        title: 'Add a task',
        description: TOOL_DESCRIPTIONS.worker.add_task,
        inputSchema: z.object({
          title: titleInput,
          steps: stepsInput,
          queue: z.boolean().default(true),
          assign_to: assignToInput,
          ...sessionInput,
        }),
      },
      asCaller(context, 'add_task', ({ title, steps, queue, assign_to: assignTo }, caller) => {
        const at = now()
        const worker = assignTo === undefined ? undefined : resolveWorker(database, at, assignTo)
        if (isRefusal(worker)) return refusalResult(worker)
        return answer(
          addTask(database, caller.id, at, {
            title,
            steps: fromModelSteps(steps),
            queue,
            assignTo: worker?.id,
          }),
          ({ state }) => addTaskText(state, worker?.name)
        )
      })
    ),

    queue_task: server.registerTool(
      'queue_task',
      {
        title: 'Queue a task',
        description: TOOL_DESCRIPTIONS.worker.queue_task,
        inputSchema: z.object({ task: taskInput, ...sessionInput }),
      },
      asCaller(context, 'queue_task', ({ task }, caller) =>
        answer(queueTask(database, caller.id, now(), task), ({ state }) => queueTaskText(state))
      )
    ),

    add_follow_up: server.registerTool(
      'add_follow_up',
      {
        title: 'Add follow-up steps',
        description: TOOL_DESCRIPTIONS.worker.add_follow_up,
        inputSchema: z.object({
          task: taskInput,
          steps: stepsInput,
          placement: z.enum(['first', 'last']),
          ...sessionInput,
        }),
      },
      asCaller(context, 'add_follow_up', ({ task, steps, placement }, caller) =>
        answer(
          addFollowUp(database, caller.id, now(), task, {
            steps: fromModelSteps(steps),
            placement,
          }),
          ({ state }) => addFollowUpText(state, steps.length)
        )
      )
    ),

    claim_step: server.registerTool(
      'claim_step',
      {
        title: 'Claim a step',
        description: TOOL_DESCRIPTIONS.worker.claim_step,
        inputSchema: z.object({ task: taskInput.optional(), ...sessionInput }),
      },
      asCaller(context, 'claim_step', ({ task }, caller) =>
        answer(claimStep(database, caller.id, now(), task), ({ state }) => {
          const events = readTask(database, state.task.id)?.events ?? []
          return claimStepText(state, caller.id, blockHistory(events, now()))
        })
      )
    ),

    update_step: server.registerTool(
      'update_step',
      {
        title: 'Note progress on a step',
        description: TOOL_DESCRIPTIONS.worker.update_step,
        inputSchema: z.object({
          task: taskInput,
          note: noteInput,
          links: linksInput,
          ...sessionInput,
        }),
      },
      asCaller(context, 'update_step', ({ task, note, links }, caller) =>
        answer(updateStep(database, caller.id, now(), task, { note, links }), ({ state }) =>
          updateStepText(state)
        )
      )
    ),

    ask_you: server.registerTool(
      'ask_you',
      {
        title: 'Ask the user a question',
        description: TOOL_DESCRIPTIONS.worker.ask_you,
        inputSchema: z.object({ task: taskInput, form: formInput, ...sessionInput }),
      },
      asCaller(context, 'ask_you', ({ task, form }, caller) =>
        caller.kind === 'dedicated'
          ? refusalResult(invalid(DEDICATED_ASK))
          : answer(askYou(database, caller.id, now(), task, form), ({ state }) => askYouText(state))
      )
    ),

    complete_step: server.registerTool(
      'complete_step',
      {
        title: 'Complete a step',
        description: TOOL_DESCRIPTIONS.worker.complete_step,
        inputSchema: z.object({
          task: taskInput,
          summary: summaryInput,
          links: linksInput,
          artifact_url: artifactUrlInput,
          ...sessionInput,
        }),
      },
      asCaller(
        context,
        'complete_step',
        ({ task, summary, links, artifact_url: artifactUrl }, caller) =>
          answer(
            completeStep(database, caller.id, now(), task, { summary, links, artifactUrl }),
            ({ state, events }) => completeStepText(state, events, caller.kind)
          )
      )
    ),

    block_step: server.registerTool(
      'block_step',
      {
        title: 'Block a step',
        description: TOOL_DESCRIPTIONS.worker.block_step,
        inputSchema: z.object({ task: taskInput, reason: reasonInput, ...sessionInput }),
      },
      asCaller(context, 'block_step', ({ task, reason }, caller) =>
        answer(blockStep(database, caller.id, now(), task, reason), ({ state }) =>
          blockStepText(state)
        )
      )
    ),

    unblock_step: server.registerTool(
      'unblock_step',
      {
        title: 'Unblock a step',
        description: TOOL_DESCRIPTIONS.worker.unblock_step,
        inputSchema: z.object({ task: taskInput, note: noteInput.optional(), ...sessionInput }),
      },
      asCaller(context, 'unblock_step', ({ task, note }, caller) =>
        answer(unblockStep(database, caller.id, now(), task, note), ({ state }) =>
          unblockStepText(state)
        )
      )
    ),
  }
}
