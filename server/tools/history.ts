import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  getHistoryResultSchema,
  historyPropsSchema,
  type GetHistoryResult,
} from '../../shared/props.js'
import { readRevision } from '../../store/queries.js'
import { TOOL_DESCRIPTIONS } from '../instructions.js'
import { readHistoryProps } from '../props/history.js'
import { guarded } from '../results.js'
import { historyText } from '../text/history.js'
import { asCaller, type ToolContext } from './context.js'
import { sessionInput } from './session_input.js'

const filterInput = z
  .string()
  .max(200)
  .optional()
  .describe('Matches a task’s title, ignoring case, or its id, such as T-012')

/**
 * show_history, which the model calls to draw the History view, and
 * get_history, which only the views call, to fetch a page and to poll it.
 */
export function registerHistoryTools(server: McpServer, context: ToolContext) {
  const showHistory = registerAppTool(
    server,
    'show_history',
    {
      title: 'Show the history',
      description: TOOL_DESCRIPTIONS.worker.show_history,
      inputSchema: z.object({ filter: filterInput, ...sessionInput }),
      outputSchema: historyPropsSchema,
      _meta: { ui: { resourceUri: context.views.history } },
    },
    asCaller(context, 'show_history', ({ filter }) => {
      const props = readHistoryProps(context.database, context.now(), 1, filter)
      return {
        content: [{ type: 'text', text: historyText(props) }],
        structuredContent: props,
      }
    })
  )

  registerAppTool(
    server,
    'get_history',
    {
      title: 'Get the history',
      description:
        'Returns one page of the history props, or {changed: false} when the board is still at sinceRevision. A page past the end returns the last page. For the views only.',
      inputSchema: z.object({
        page: z.number().int().positive().describe('The page, from 1'),
        filter: filterInput,
        sinceRevision: z.number().int().nonnegative().optional(),
      }),
      outputSchema: getHistoryResultSchema,
      _meta: { ui: { visibility: ['app'] } },
    },
    guarded(context.logger, 'get_history', ({ page, filter, sinceRevision }) => {
      if (sinceRevision !== undefined) {
        const revision = readRevision(context.database)
        if (sinceRevision === revision) {
          const unchanged: GetHistoryResult = { changed: false, revision }
          return {
            content: [{ type: 'text', text: `History, revision ${revision}, unchanged` }],
            structuredContent: unchanged,
          }
        }
      }
      const props = readHistoryProps(context.database, context.now(), page, filter)
      return {
        content: [
          {
            type: 'text',
            text: `History, page ${props.page} of ${props.pageCount}, revision ${props.revision}`,
          },
        ],
        structuredContent: props,
      }
    })
  )

  return { show_history: showHistory }
}
