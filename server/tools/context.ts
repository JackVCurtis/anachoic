import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server'
import { isRefusal, type Refusal } from '../../domain/refusal.js'
import type { Instant } from '../../domain/types.js'
import type { Database } from '../../store/database.js'
import type { Caller, Callers } from '../callers.js'
import type { ClientInfo } from '../identity.js'
import type { Logger } from '../logger.js'
import { guarded, refusalResult } from '../results.js'
import type { WaitTimings } from '../wait_timings.js'
import type { ViewUris } from '../views.js'

/**
 * What every tool handler needs from its server and process.
 */
export interface ToolContext {
  logger: Logger
  database: Database
  callers: Callers
  /** The client of the connection the call arrived on. */
  client: () => ClientInfo | undefined
  now: () => Instant
  wait: WaitTimings
  /** Each view's ui:// address, which changes whenever the view's HTML does. */
  views: ViewUris
  /**
   * Set when the board's database cannot be read: every tool returns it, and
   * none touches the database.
   */
  unreadable?: Refusal
}

/**
 * Wraps a tool's handler: refuses every call while the database cannot be
 * read, and turns an unexpected exception into the fixed sentence.
 */
export function asTool<Args extends unknown[]>(
  context: Pick<ToolContext, 'logger' | 'unreadable'>,
  tool: string,
  handler: (...args: Args) => CallToolResult | Promise<CallToolResult>
): (...args: Args) => Promise<CallToolResult> {
  return guarded(context.logger, tool, (...args: Args) =>
    context.unreadable ? refusalResult(context.unreadable) : handler(...args)
  )
}

/**
 * Wraps a model tool's handler: resolves and touches the calling session
 * before the tool runs, refuses the call when the session it names is
 * unknown, and turns an unexpected exception into the fixed sentence.
 */
export function asCaller<Args extends { session?: string }>(
  context: ToolContext,
  tool: string,
  handler: (
    args: Args,
    caller: Caller,
    request: ServerContext
  ) => CallToolResult | Promise<CallToolResult>
): (args: Args, request: ServerContext) => Promise<CallToolResult> {
  return asTool(context, tool, (args: Args, request: ServerContext) => {
    const caller = context.callers.enter(context.client(), args.session)
    if (isRefusal(caller)) return refusalResult(caller)
    return handler(args, caller, request)
  })
}
