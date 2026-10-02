import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  boardPropsSchema,
  getBoardResultSchema,
  type BoardProps,
  type GetBoardResult,
} from '../../shared/props.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { emptyBoard } from '../props/empty_board.js'
import { guarded } from '../results.js'
import { boardSummary } from '../text/board_summary.js'
import { VIEWS } from '../views.js'
import { asCaller, type ToolContext } from './context.js'
import { sessionInput } from './session_input.js'

export type BoardSource = () => BoardProps

/**
 * show_board, which the model calls to draw the board, and get_board, which
 * only the view calls, to fetch the board on connect and to poll it.
 */
export function registerBoardTools(
  server: McpServer,
  context: ToolContext,
  board: BoardSource = () => emptyBoard()
) {
  registerAppTool(
    server,
    'show_board',
    {
      title: 'Show the board',
      description: TOOL_DESCRIPTIONS.show_board,
      inputSchema: z.object({ ...sessionInput }),
      outputSchema: boardPropsSchema,
      _meta: { ui: { resourceUri: VIEWS.board } },
    },
    asCaller(context, 'show_board', () => {
      const props = board()
      return {
        content: [{ type: 'text', text: boardSummary(props) }],
        structuredContent: props,
      }
    })
  )

  registerAppTool(
    server,
    'get_board',
    {
      title: 'Get the board',
      description:
        'Returns the board props, or {changed: false} when the board is still at sinceRevision. For the board view only.',
      inputSchema: z.object({
        sinceRevision: z.number().int().nonnegative().optional(),
      }),
      outputSchema: getBoardResultSchema,
      _meta: { ui: { visibility: ['app'] } },
    },
    guarded(context.logger, 'get_board', ({ sinceRevision }) => {
      const props = board()
      const result: GetBoardResult =
        sinceRevision === props.revision ? { changed: false, revision: props.revision } : props
      const text =
        'changed' in result
          ? `Board, revision ${props.revision}, unchanged`
          : `Board, revision ${props.revision}`
      return { content: [{ type: 'text', text }], structuredContent: result }
    })
  )
}
