import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { invalid } from '../../domain/refusal.js'
import { formatTaskId } from '../../shared/task_id.js'
import { firstClaimable, type Claimable } from '../../store/queries.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { refusalResult, textResult } from '../results.js'
import { asCaller, type ToolContext } from './context.js'
import { sessionInput } from './session_input.js'
import { keepAlive, pause } from './waiting.js'

export const NO_WORK_YET = 'No work yet. Call wait_for_work again to keep waiting.'
export const DEDICATED_WAIT_FOR_WORK = 'This chat does not wait'

/**
 * The work found, and the call that takes it.
 */
export function workText({ taskId, assigned }: Claimable): string {
  const id = formatTaskId(taskId)
  const where = assigned ? 'is assigned to you' : 'is in the queue'
  return `${id} ${where}. Call claim_step with task ${id}.`
}

/**
 * wait_for_work: an idle worker waits inside the call until the queue holds
 * a task it may claim, those assigned to it first. Each poll is a read, so
 * no transaction or lock is held across the wait, and nothing is claimed.
 */
export function registerWaitForWork(server: McpServer, context: ToolContext) {
  const { database, logger, wait } = context

  return server.registerTool(
    'wait_for_work',
    {
      title: 'Wait for work',
      description: TOOL_DESCRIPTIONS.worker.wait_for_work,
      inputSchema: z.object({ ...sessionInput }),
    },
    asCaller(context, 'wait_for_work', async (_args, caller, request) => {
      if (caller.kind === 'dedicated') return refusalResult(invalid(DEDICATED_WAIT_FOR_WORK))

      const { signal } = request.mcpReq
      const started = Date.now()
      let polls = 0
      const end = (reason: string, result: CallToolResult, task?: number) => {
        logger.log('work_wait_end', { reason, polls, ms: Date.now() - started, task })
        return result
      }
      const stopProgress = keepAlive(request, wait.progressMs, (error) =>
        logger.log('work_wait_progress_failed', { message: String(error) })
      )
      logger.log('work_wait_start', {})

      try {
        for (;;) {
          if (signal.aborted) return end('cancelled', textResult('Stopped waiting.'))
          polls += 1
          logger.log('work_wait_poll', { poll: polls })
          const found = firstClaimable(database, caller.id)
          if (found) {
            return end(
              found.assigned ? 'assigned' : 'queued',
              textResult(workText(found)),
              found.taskId
            )
          }
          const remaining = wait.timeoutMs - (Date.now() - started)
          if (remaining <= 0) return end('timeout', textResult(NO_WORK_YET))
          await pause(Math.min(wait.pollMs, remaining), signal)
        }
      } finally {
        stopProgress()
      }
    })
  )
}
