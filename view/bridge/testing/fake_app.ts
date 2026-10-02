import type { App } from '@modelcontextprotocol/ext-apps'
import type { CallToolResult } from '@modelcontextprotocol/client'
import type { HostApp, HostContext } from '../connect'

type CallParams = Parameters<HostApp['callServerTool']>[0]
type MessageParams = Parameters<App['sendMessage']>[0]
type DisplayModeParams = Parameters<HostApp['requestDisplayMode']>[0]
type ToolResultHandler = NonNullable<HostApp['ontoolresult']>
type HostContextHandler = NonNullable<HostApp['onhostcontextchanged']>

/**
 * How the fake answers a tool call: a result, or an error to throw.
 */
export type ToolAnswer = (
  params: CallParams
) => CallToolResult | Error | Promise<CallToolResult | Error>

export interface FakeAppOptions {
  /** The host context the handshake returns. */
  hostContext?: HostContext
  /** Answers every tool call. An empty result unless given. */
  answer?: ToolAnswer
  /** A tool result the host replays as soon as the view has connected. */
  replayedResult?: CallToolResult
}

/**
 * Stands in for the SDK's App in ui tests of the bridge and the entries. It
 * records every call, and the test emits what the host would send.
 */
export class FakeApp implements HostApp {
  ontoolresult: ToolResultHandler | undefined = undefined
  onhostcontextchanged: HostContextHandler | undefined = undefined

  readonly calls = {
    connect: 0,
    callServerTool: [] as CallParams[],
    sendMessage: [] as MessageParams[],
    requestDisplayMode: [] as DisplayModeParams[],
  }

  #hostContext: HostContext
  #answer: ToolAnswer
  #replayedResult: CallToolResult | undefined

  constructor({ hostContext = {}, answer, replayedResult }: FakeAppOptions = {}) {
    this.#hostContext = hostContext
    this.#answer = answer ?? (() => ({ content: [] }))
    this.#replayedResult = replayedResult
  }

  async connect(): Promise<void> {
    this.calls.connect += 1
    if (this.#replayedResult) {
      const result = this.#replayedResult
      queueMicrotask(() => this.emitToolResult(result))
    }
  }

  getHostContext(): HostContext | undefined {
    return this.#hostContext
  }

  async callServerTool(params: CallParams): Promise<CallToolResult> {
    this.calls.callServerTool.push(params)
    const answer = await this.#answer(params)
    if (answer instanceof Error) {
      throw answer
    }
    return answer
  }

  /**
   * Not part of HostApp, since the view never posts a message; recorded so a
   * test can show that nothing was posted.
   */
  async sendMessage(params: MessageParams) {
    this.calls.sendMessage.push(params)
    return {}
  }

  async requestDisplayMode(params: DisplayModeParams) {
    this.calls.requestDisplayMode.push(params)
    return { mode: params.mode }
  }

  /** Sends a partial host context change, as the host does. */
  emitHostContextChange(change: HostContext) {
    this.#hostContext = { ...this.#hostContext, ...change }
    this.onhostcontextchanged?.(change)
  }

  emitToolResult(result: CallToolResult) {
    this.ontoolresult?.(result)
  }

  /** The tool calls made so far with the given name. */
  callsTo(name: string) {
    return this.calls.callServerTool.filter((call) => call.name === name)
  }
}
