import type { CallToolResult } from '@modelcontextprotocol/client'
import type { BoardProps, GetBoardResult } from '../../../shared/props'

/**
 * The board the server sends before anything has been added.
 */
export function emptyBoardProps(revision = 0): BoardProps {
  return {
    revision,
    now: '2026-03-12T09:41:00.000Z',
    yourTurn: [],
    working: [],
    queue: [],
    backlog: [],
    toSignOff: [],
    signedOff: [],
    sessions: [],
    counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
  }
}

/**
 * A tool result carrying the given board result, as get_board and show_board
 * send it.
 */
export function boardResult(result: GetBoardResult): CallToolResult {
  return {
    content: [{ type: 'text', text: `Board, revision ${result.revision}` }],
    structuredContent: result,
  }
}
