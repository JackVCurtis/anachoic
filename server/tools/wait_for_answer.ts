import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { invalid, isRefusal, type Refusal } from '../../domain/refusal.js'
import { formatTaskId, toTaskNumber } from '../../shared/task_id.js'
import {
  checkWaiting,
  collectAnswer,
  readAnswerState,
  type AnswerState,
  type TaskRef,
} from '../../store/services.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { refusalResult, textResult } from '../results.js'
import { asCaller, type ToolContext } from './context.js'
import { taskInput } from './inputs.js'
import { sessionInput } from './session_input.js'
import { keepAlive, pause } from './waiting.js'

export const NO_ANSWER_YET = 'No answer yet. Call wait_for_answer again to keep waiting.'
export const DEDICATED_WAIT = 'This chat does not wait'

export function answeredText(task: TaskRef, answer: string) {
  return `The user answered your question on ${formatTaskId(toTaskNumber(task))}:\n${answer}`
}

/**
 * wait_for_answer: a worker waits inside the call for your answer to the
 * question on the step it claimed. Each poll is a read; only collecting the
 * answer writes, so no transaction or lock is held across the wait.
 */
export function registerWaitForAnswer(server: McpServer, context: ToolContext) {
  const { database, logger, wait } = context

  return server.registerTool(
    'wait_for_answer',
    {
      title: 'Wait for the user’s answer',
      description: TOOL_DESCRIPTIONS.worker.wait_for_answer,
      inputSchema: z.object({ task: taskInput, ...sessionInput }),
    },
    asCaller(context, 'wait_for_answer', async ({ task }, caller, request) => {
      if (caller.kind === 'dedicated') return refusalResult(invalid(DEDICATED_WAIT))
      const refused = checkWaiting(database, task, caller.id)
      if (refused) return refusalResult(refused)

      const { signal } = request.mcpReq
      const started = Date.now()
      let polls = 0
      const end = (reason: string, result: CallToolResult) => {
        logger.log('wait_end', { task, reason, polls, ms: Date.now() - started })
        return result
      }
      const stopProgress = keepAlive(request, wait.progressMs, (error) =>
        logger.log('wait_progress_failed', { task, message: String(error) })
      )
      logger.log('wait_start', { task })

      try {
        for (;;) {
          if (signal.aborted) return end('cancelled', textResult('Stopped waiting.'))
          polls += 1
          let state: AnswerState | Refusal = readAnswerState(database, task, caller.id)
          if (!isRefusal(state) && state.kind === 'answered') {
            const collected = collectAnswer(database, task, caller.id)
            // A busy board is tried again at the next poll.
            state = isRefusal(collected) ? { kind: 'waiting' } : collected.value
          }
          if (isRefusal(state)) return end('refused', refusalResult(state))
          switch (state.kind) {
            case 'answered':
              return end('answered', textResult(answeredText(task, state.answer)))
            case 'ended':
              return end(state.reason, textResult(state.sentence))
            case 'none':
              return end(
                'none',
                refusalResult(
                  checkWaiting(database, task, caller.id) ??
                    invalid(`No question waits on ${formatTaskId(toTaskNumber(task))}`)
                )
              )
            case 'waiting':
              break
          }
          const remaining = wait.timeoutMs - (Date.now() - started)
          if (remaining <= 0) return end('timeout', textResult(NO_ANSWER_YET))
          await pause(Math.min(wait.pollMs, remaining), signal)
        }
      } finally {
        stopProgress()
      }
    })
  )
}
