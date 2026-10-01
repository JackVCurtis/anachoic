import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import type { Transport } from '@modelcontextprotocol/client'

export const APP_INFO = { name: 'anachoic', version: '1' } as const

/**
 * The part of the SDK's App the bridge uses, so a fake can stand in for it.
 */
export type HostApp = Pick<
  App,
  | 'connect'
  | 'getHostContext'
  | 'callServerTool'
  | 'sendMessage'
  | 'requestDisplayMode'
  | 'ontoolresult'
  | 'onhostcontextchanged'
>

export type HostContext = McpUiHostContext

/**
 * The host context the views use. Everything else the host sends, its theme,
 * styles and fonts included, is kept but never applied.
 */
export interface ViewHostContext {
  displayMode: HostContext['displayMode']
  availableDisplayModes: HostContext['availableDisplayModes']
  safeAreaInsets: HostContext['safeAreaInsets']
  locale: HostContext['locale']
  timeZone: HostContext['timeZone']
}

/**
 * One merged host context. A change whose only key is containerDimensions is
 * absorbed silently: auto-resize already reports the view's height, and a
 * redraw in answer to the host's new dimensions is what feeds a resize loop.
 */
export interface HostContextStore {
  getSnapshot(): HostContext
  /** The parts the views use. Its identity changes only when one of them does. */
  getViewSnapshot(): ViewHostContext
  subscribe(listener: () => void): () => void
  merge(change: HostContext): void
}

function pickViewContext(context: HostContext): ViewHostContext {
  return {
    displayMode: context.displayMode,
    availableDisplayModes: context.availableDisplayModes,
    safeAreaInsets: context.safeAreaInsets,
    locale: context.locale,
    timeZone: context.timeZone,
  }
}

function sameViewContext(a: ViewHostContext, b: ViewHostContext) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function createHostContextStore(initial: HostContext = {}): HostContextStore {
  let context = initial
  let viewContext = pickViewContext(initial)
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => context,
    getViewSnapshot: () => viewContext,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    merge(change) {
      context = { ...context, ...change }
      const keys = Object.keys(change)
      if (keys.length === 0 || keys.every((key) => key === 'containerDimensions')) {
        return
      }
      const next = pickViewContext(context)
      if (sameViewContext(next, viewContext)) {
        return
      }
      viewContext = next
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

/**
 * The task id in a replayed tool result's structuredContent, if it carries
 * one. Nothing else in the result is kept, because it may be old.
 */
function taskIdOf(structuredContent: unknown): string | undefined {
  if (typeof structuredContent !== 'object' || structuredContent === null) {
    return undefined
  }
  const task = (structuredContent as { task?: unknown }).task
  if (typeof task !== 'object' || task === null) {
    return undefined
  }
  const id = (task as { id?: unknown }).id
  return typeof id === 'string' ? id : undefined
}

export interface HostConnection {
  app: HostApp
  hostContext: HostContextStore
  /** The task id from the replayed tool result, for the task view. */
  replayedTaskId(): string | undefined
}

export interface ConnectOptions {
  app?: HostApp
  /** The SDK's postMessage transport to the parent window unless given. */
  transport?: Transport
  /** Called when a replayed tool result names a task. */
  onReplayedTaskId?: (taskId: string) => void
}

export function createApp(): App {
  return new App(APP_INFO, {}, { autoResize: true })
}

/**
 * Connects a view to its host. The handlers are set before connecting, so
 * nothing the host sends during the handshake is missed. The bridge applies
 * none of the host's styles, fonts or theme, sends no model context, and sets
 * no teardown handler, which desktop never calls.
 */
export async function connectToHost({
  app = createApp(),
  transport,
  onReplayedTaskId,
}: ConnectOptions = {}): Promise<HostConnection> {
  const hostContext = createHostContextStore()
  let replayedTaskId: string | undefined

  app.ontoolresult = (result) => {
    const taskId = taskIdOf(result.structuredContent)
    if (taskId !== undefined) {
      replayedTaskId = taskId
      onReplayedTaskId?.(taskId)
    }
  }
  app.onhostcontextchanged = (change) => hostContext.merge(change)

  await app.connect(transport)
  hostContext.merge(app.getHostContext() ?? {})

  return { app, hostContext, replayedTaskId: () => replayedTaskId }
}
