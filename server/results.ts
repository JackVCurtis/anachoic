import type { CallToolResult } from '@modelcontextprotocol/server'
import { describeError, type Logger } from './logger.js'

export const UNEXPECTED_ERROR = 'Something went wrong. Details are in the server log.'

export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

export function refusalResult(refusal: { readonly sentence: string }): CallToolResult {
  return { content: [{ type: 'text', text: refusal.sentence }], isError: true }
}

/**
 * Wraps a tool handler so an unexpected exception becomes a fixed sentence
 * for the client, with the stack written to the log.
 */
export function guarded<Args extends unknown[]>(
  logger: Logger,
  tool: string,
  handler: (...args: Args) => CallToolResult | Promise<CallToolResult>
): (...args: Args) => Promise<CallToolResult> {
  return async (...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      logger.log('tool_failed', { tool, ...describeError(error) })
      return { content: [{ type: 'text', text: UNEXPECTED_ERROR }], isError: true }
    }
  }
}
