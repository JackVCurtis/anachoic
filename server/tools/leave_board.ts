import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { isRefusal } from '../../domain/refusal.js'
import { removeSession } from '../../store/sessions.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { refusalResult, textResult } from '../results.js'
import { asCaller, type ToolContext } from './context.js'
import { sessionInput } from './session_input.js'

export const LEFT_THE_BOARD = 'Left the board. Your claims went back to the queue.'

/**
 * leave_board: a worker ends and removes its own session before it is closed
 * on purpose, so the board drops it at once. A later call revives it.
 */
export function registerLeaveBoard(server: McpServer, context: ToolContext) {
  return server.registerTool(
    'leave_board',
    {
      title: 'Leave the board',
      description: TOOL_DESCRIPTIONS.worker.leave_board,
      inputSchema: z.object({ ...sessionInput }),
    },
    asCaller(context, 'leave_board', (_args, caller) => {
      const removed = removeSession(context.database, caller.id, context.now())
      return isRefusal(removed) ? refusalResult(removed) : textResult(LEFT_THE_BOARD)
    })
  )
}
