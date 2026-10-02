import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { isRefusal } from '../../domain/refusal.js'
import {
  addFollowUp,
  addTask,
  askYou,
  claimStep,
  completeStep,
  queueTask,
  updateStep,
  type ServiceResult,
} from '../../store/services.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { refusalResult, textResult } from '../results.js'
import {
  addFollowUpText,
  addTaskText,
  askYouText,
  claimStepText,
  completeStepText,
  queueTaskText,
  updateStepText,
} from '../text/model_tools.js'
import { asCaller, type ToolContext } from './context.js'
import {
  linksInput,
  noteInput,
  questionInput,
  stepsInput,
  summaryInput,
  taskInput,
  titleInput,
} from './inputs.js'
import { sessionInput } from './session_input.js'

/**
 * The result of a service as a model tool returns it: the text built from
 * what it did, or the refusal's sentence as an error. No structured content.
 */
function answer<T>(result: ServiceResult<T>, text: (value: T) => string) {
  return isRefusal(result) ? refusalResult(result) : textResult(text(result.value))
}

export const MODEL_TOOLS = [
  'add_task',
  'queue_task',
  'add_follow_up',
  'claim_step',
  'update_step',
  'ask_you',
  'complete_step',
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
        description: TOOL_DESCRIPTIONS.add_task,
        inputSchema: z.object({
          title: titleInput,
          steps: stepsInput,
          queue: z.boolean().default(true),
          ...sessionInput,
        }),
      },
      asCaller(context, 'add_task', ({ title, steps, queue }, caller) =>
        answer(addTask(database, caller.id, now(), { title, steps, queue }), ({ state }) =>
          addTaskText(state)
        )
      )
    ),

    queue_task: server.registerTool(
      'queue_task',
      {
        title: 'Queue a task',
        description: TOOL_DESCRIPTIONS.queue_task,
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
        description: TOOL_DESCRIPTIONS.add_follow_up,
        inputSchema: z.object({
          task: taskInput,
          steps: stepsInput,
          placement: z.enum(['first', 'last']),
          ...sessionInput,
        }),
      },
      asCaller(context, 'add_follow_up', ({ task, steps, placement }, caller) =>
        answer(addFollowUp(database, caller.id, now(), task, { steps, placement }), ({ state }) =>
          addFollowUpText(state, steps.length)
        )
      )
    ),

    claim_step: server.registerTool(
      'claim_step',
      {
        title: 'Claim a step',
        description: TOOL_DESCRIPTIONS.claim_step,
        inputSchema: z.object({ task: taskInput.optional(), ...sessionInput }),
      },
      asCaller(context, 'claim_step', ({ task }, caller) =>
        answer(claimStep(database, caller.id, now(), task), ({ state }) => claimStepText(state))
      )
    ),

    update_step: server.registerTool(
      'update_step',
      {
        title: 'Note progress on a step',
        description: TOOL_DESCRIPTIONS.update_step,
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
        title: 'Ask the person a question',
        description: TOOL_DESCRIPTIONS.ask_you,
        inputSchema: z.object({ task: taskInput, question: questionInput, ...sessionInput }),
      },
      asCaller(context, 'ask_you', ({ task, question }, caller) =>
        answer(askYou(database, caller.id, now(), task, question), ({ state }) =>
          askYouText(state, caller.kind)
        )
      )
    ),

    complete_step: server.registerTool(
      'complete_step',
      {
        title: 'Complete a step',
        description: TOOL_DESCRIPTIONS.complete_step,
        inputSchema: z.object({
          task: taskInput,
          summary: summaryInput,
          links: linksInput,
          ...sessionInput,
        }),
      },
      asCaller(context, 'complete_step', ({ task, summary, links }, caller) =>
        answer(
          completeStep(database, caller.id, now(), task, { summary, links }),
          ({ state, events }) => completeStepText(state, events)
        )
      )
    ),
  }
}
