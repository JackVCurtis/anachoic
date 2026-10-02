import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { isRefusal } from '../../domain/refusal.js'
import { LIMITS } from '../../shared/limits.js'
import { setSessionName } from '../../store/sessions.js'
import { refusalResult, textResult } from '../results.js'
import { joinBoardText } from '../text/join_board.js'
import { asCaller, type ToolContext } from './context.js'
import { sessionInput } from './session_input.js'

export function registerJoinBoard(server: McpServer, context: ToolContext) {
  return server.registerTool(
    'join_board',
    {
      title: 'Join the board',
      description:
        'Joins the Anachoic board, optionally setting this session’s display name (1–40 characters). Returns the session’s id, kind and name.',
      inputSchema: z.object({
        name: z.string().min(LIMITS.sessionName.min).max(LIMITS.sessionName.max).optional(),
        ...sessionInput,
      }),
    },
    asCaller(context, 'join_board', ({ name }, caller) => {
      if (name === undefined) return textResult(joinBoardText(caller))
      const named = setSessionName(context.database, caller.id, name)
      if (isRefusal(named)) return refusalResult(named)
      return textResult(joinBoardText({ ...caller, name: named.value.name }))
    })
  )
}
