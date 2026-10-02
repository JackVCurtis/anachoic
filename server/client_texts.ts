import type {
  InitializeRequest,
  InitializeResult,
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/server'
import { kindOfClient } from './identity.js'
import { INSTRUCTIONS, TOOL_DESCRIPTIONS, type DescribedTool } from './instructions.js'

/**
 * The SDK's own initialize handler, which records the client and builds the
 * result. It is not part of the SDK's typed surface.
 */
interface Initializer {
  _oninitialize(request: InitializeRequest): Promise<InitializeResult>
}

/**
 * Answers initialize with the instructions for the kind of session the
 * client is, and gives each tool that kind's description before tools/list
 * can be asked. The SDK takes one instructions text per server, so the
 * server takes over the initialize request and keeps the SDK's handling of
 * it.
 */
export function chooseTextsByClient(
  server: McpServer,
  tools: Partial<Record<DescribedTool, RegisteredTool>>
) {
  const sdk = server.server as unknown as Initializer
  server.server.setRequestHandler('initialize', async (request) => {
    const kind = kindOfClient(request.params.clientInfo)
    for (const [name, tool] of Object.entries(tools)) {
      // Assigned rather than through update(), which would send a list_changed
      // notification before the client has been answered.
      tool.description = TOOL_DESCRIPTIONS[kind][name as DescribedTool]
    }
    const result = await sdk._oninitialize.call(server.server, request)
    return { ...result, instructions: INSTRUCTIONS[kind] }
  })
}
