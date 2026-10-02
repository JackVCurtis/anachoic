import {
  isInitializeRequest,
  type JSONRPCMessage,
  type McpServer,
  type MessageExtraInfo,
  type RegisteredTool,
  type Transport,
  type TransportSendOptions,
} from '@modelcontextprotocol/server'
import type { SessionKind } from '../domain/types.js'
import { kindOfClient } from './identity.js'
import { TOOL_DESCRIPTIONS, type DescribedTool } from './instructions.js'

/**
 * Gives each tool the description for the kind of session its server serves.
 * Called before the server connects, so update() sends no list_changed.
 */
export function describeTools(
  kind: SessionKind,
  tools: Partial<Record<DescribedTool, RegisteredTool>>
) {
  for (const [name, tool] of Object.entries(tools)) {
    tool.update({ description: TOOL_DESCRIPTIONS[kind][name as DescribedTool] })
  }
}

/**
 * The kind of session an incoming message, or batch of messages, opens. Only
 * an initialize request names its client, so anything else is a worker.
 */
export function kindOfOpening(body: unknown): SessionKind {
  const messages: unknown[] = Array.isArray(body) ? body : [body]
  const opening = messages.find((message) => isInitializeRequest(message))
  return opening ? kindOfClient(opening.params.clientInfo) : 'worker'
}

/**
 * Hands one server's traffic to the connection's transport. Closing it ends
 * only that server, so the connection can move on to another.
 */
class Link implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void

  constructor(private readonly connection: Transport) {}

  async start() {}

  send(message: JSONRPCMessage, options?: TransportSendOptions) {
    return this.connection.send(message, options)
  }

  async close() {
    this.onclose?.()
  }

  setProtocolVersion(version: string) {
    this.connection.setProtocolVersion?.(version)
  }
}

export interface ClientConnection {
  close(): Promise<void>
}

/**
 * Serves one connection with a server built for the kind of client that
 * opens it, so the SDK sends that kind's instructions and tool descriptions.
 * A message before initialize, such as a newer client's server/discover probe,
 * is answered by a worker server, which initialize replaces when the client
 * is of another kind.
 */
export async function serveByClient(
  transport: Transport,
  build: (kind: SessionKind) => McpServer,
  onclose: () => void
): Promise<ClientConnection> {
  let current: { server: McpServer; link: Link } | undefined
  let initialized = false

  const attach = (kind: SessionKind) => {
    const previous = current
    const link = new Link(transport)
    const server = build(kind)
    // connect() installs the link's handlers before its first await, so the
    // message that triggered attach can be delivered straight after.
    void server.connect(link)
    current = { server, link }
    if (previous) void previous.server.close()
    return current
  }

  transport.onmessage = (message, extra) => {
    let target = current
    if (!initialized && isInitializeRequest(message)) {
      initialized = true
      const kind = kindOfClient(message.params.clientInfo)
      if (!target || kind !== 'worker') target = attach(kind)
    }
    target ??= attach('worker')
    target.link.onmessage?.(message, extra)
  }
  transport.onerror = (error) => current?.link.onerror?.(error)
  transport.onclose = () => {
    current?.link.onclose?.()
    onclose()
  }
  await transport.start()

  return {
    async close() {
      await current?.server.close()
      await transport.close()
    },
  }
}
