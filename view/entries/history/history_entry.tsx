import { useMemo } from 'react'
import {
  connectToHost,
  createApp,
  type ConnectOptions,
  type HostApp,
  type HostConnection,
} from '../../bridge/connect'
import { HostContextProvider } from '../../bridge/host_context'
import { openHistorySource, type HistorySource } from '../../bridge/history_source'
import { createYourActions } from '../../bridge/wake'
import { HistoryPanel } from './history_panel'

/**
 * How long the view waits after connecting for the replayed show_history
 * result, whose filter it starts with. After that it starts unfiltered.
 */
export const REPLAY_WAIT_MS = 500

export interface LoadedHistory {
  connection: HostConnection
  /** The filter the replayed show_history result was given, or ''. */
  filter: string
  source: HistorySource
}

type ToolResult = Parameters<NonNullable<HostApp['ontoolresult']>>[0]

/**
 * The filter a show_history result carries, if it carries the history props.
 */
function filterOf(result: ToolResult): string | undefined {
  const content = result.structuredContent
  if (typeof content !== 'object' || content === null || !('rows' in content)) {
    return undefined
  }
  const { filter } = content as { filter?: unknown }
  return typeof filter === 'string' ? filter : undefined
}

/**
 * The app, with every tool result also read for its filter. The bridge sets
 * its own result handler while connecting, so the filter is read inside it.
 */
function readingFilter(app: HostApp, onFilter: (filter: string) => void): HostApp {
  return {
    connect: (...args) => app.connect(...args),
    getHostContext: () => app.getHostContext(),
    callServerTool: (...args) => app.callServerTool(...args),
    requestDisplayMode: (...args) => app.requestDisplayMode(...args),
    openLink: (...args) => app.openLink(...args),
    get ontoolresult() {
      return app.ontoolresult
    },
    set ontoolresult(handler) {
      app.ontoolresult = (result) => {
        handler?.(result)
        const filter = filterOf(result)
        if (filter !== undefined) {
          onFilter(filter)
        }
      }
    },
    get onhostcontextchanged() {
      return app.onhostcontextchanged
    },
    set onhostcontextchanged(handler) {
      app.onhostcontextchanged = handler
    },
  }
}

/**
 * Connects to the host, takes only the filter from the replayed show_history
 * result, and fetches the first page with get_history, since the result may
 * be old. A result that has not arrived REPLAY_WAIT_MS after connecting is
 * not waited for.
 */
export async function loadHistory(options: ConnectOptions = {}): Promise<LoadedHistory> {
  let replayed: string | undefined
  let named: () => void = () => {}
  const arrived = new Promise<void>((resolve) => {
    named = resolve
  })
  const app = readingFilter(options.app ?? createApp(), (filter) => {
    replayed ??= filter
    named()
  })
  const connection = await connectToHost({ ...options, app })
  if (replayed === undefined) {
    await Promise.race([arrived, new Promise((resolve) => setTimeout(resolve, REPLAY_WAIT_MS))])
  }
  const filter = replayed ?? ''
  const source = await openHistorySource(connection.app, { page: 1, filter })
  return { connection, filter, source }
}

function History({ connection, filter, source }: LoadedHistory) {
  const yourActions = useMemo(() => createYourActions(connection.app), [connection.app])
  return (
    <HistoryPanel app={connection.app} yourActions={yourActions} source={source} filter={filter} />
  )
}

/**
 * The live History view that show_history renders: drawn from the history
 * source, which polls get_history while it is mounted. It posts nothing to
 * the chat. A title opens its task in the task panel, with "Back to history".
 */
export function HistoryEntry(loaded: LoadedHistory) {
  return (
    <HostContextProvider store={loaded.connection.hostContext}>
      <History {...loaded} />
    </HostContextProvider>
  )
}
