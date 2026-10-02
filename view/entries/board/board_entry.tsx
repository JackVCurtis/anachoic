import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { YourTurnItem } from '../../../shared/props'
import {
  openBoardSource,
  type BoardSource,
  type BoardSourceOptions,
} from '../../bridge/board_source'
import { connectToHost, type ConnectOptions, type HostConnection } from '../../bridge/connect'
import { HostContextProvider, useHostContext } from '../../bridge/host_context'
import { createYourActions } from '../../bridge/wake'
import { BoardView, type BoardAnnouncement } from '../../components/board/board_view/board_view'
import { announcement } from '../../components/helpers/announcement'
import { toBoardData } from './to_board_data'

export interface LoadedBoard {
  connection: HostConnection
  source: BoardSource
}

/**
 * Connects to the host and fetches the board, trying again until get_board
 * returns it. The tool result the host replays is never drawn, because it may
 * be old.
 */
export async function loadBoard(
  options: ConnectOptions & BoardSourceOptions = {}
): Promise<LoadedBoard> {
  const { now, ...connectOptions } = options
  const connection = await connectToHost(connectOptions)
  const source = await openBoardSource(connection.app, { now })
  return { connection, source }
}

/**
 * The sentences for the tasks a poll brought into Your turn, one per card.
 */
function arrivalAnnouncement(
  items: readonly YourTurnItem[],
  key: number
): BoardAnnouncement | null {
  const sentences = items.flatMap(({ task, step, session }) => {
    const sentence = announcement(
      step.owner === 'you'
        ? { kind: 'your-step', title: task.title }
        : { kind: 'question', title: task.title, sessionName: session?.name }
    )
    return sentence === null ? [] : [sentence]
  })
  return sentences.length === 0 ? null : { key, text: sentences.join('. ') }
}

interface LiveBoardProps {
  app: HostConnection['app']
  source: BoardSource
  onRefusal: (sentence: string) => void
}

function Board({ app, source, onRefusal }: LiveBoardProps) {
  const { safeAreaInsets } = useHostContext()
  const yourActions = useMemo(() => createYourActions(app), [app])
  const [reordering, setReordering] = useState(false)
  const { board, updatedAt, unreachable, arrived, arrivals } = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot
  )

  useEffect(() => {
    source.start()
    return () => source.stop()
  }, [source])

  const lists = useMemo(() => toBoardData(board), [board])
  const said = useMemo(() => arrivalAnnouncement(arrived, arrivals), [arrived, arrivals])

  async function reorder(taskId: string, position: number) {
    const item = board.queue.find((queued) => queued.task.id === taskId)
    if (!item) {
      return
    }
    setReordering(true)
    const outcome = await yourActions.reorderQueue(item.task, position)
    setReordering(false)
    if (outcome.ok) {
      source.replace(outcome.props)
    } else if ('refusal' in outcome) {
      onRefusal(outcome.refusal)
    }
  }

  return (
    <BoardView
      {...lists}
      updatedAt={updatedAt}
      unreachable={unreachable}
      safeAreaInsets={safeAreaInsets}
      announcement={said}
      onReorder={(taskId, position) => void reorder(taskId, position)}
      reordering={reordering}
    />
  )
}

function ignore() {}

/**
 * The live board: drawn from the source, which polls while it is mounted.
 * Your actions call their app-only tools, the board is redrawn from each
 * result, and each success is posted to the dedicated session. A refusal's
 * sentence goes to onRefusal.
 */
export function BoardEntry({
  connection,
  source,
  onRefusal = ignore,
}: {
  connection: HostConnection
  source: BoardSource
  onRefusal?: (sentence: string) => void
}) {
  return (
    <HostContextProvider store={connection.hostContext}>
      <Board app={connection.app} source={source} onRefusal={onRefusal} />
    </HostContextProvider>
  )
}
