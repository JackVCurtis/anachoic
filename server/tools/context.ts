import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server'
import { isRefusal } from '../../domain/refusal.js'
import type { Instant } from '../../domain/types.js'
import type { Database } from '../../store/database.js'
import type { Caller, Callers } from '../callers.js'
import type { ClientInfo } from '../identity.js'
import type { Logger } from '../logger.js'
import { guarded, refusalResult } from '../results.js'
import type { WaitTimings } from '../wait_timings.js'

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
  return guarded(context.logger, tool, (args: Args, request: ServerContext) => {
    const caller = context.callers.enter(context.client(), args.session)
    if (isRefusal(caller)) return refusalResult(caller)
    return handler(args, caller, request)
  })
}
