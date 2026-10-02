import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { YourTurnItem } from '../../../shared/props'
import {
  openBoardSource,
  type BoardSource,
  type BoardSourceOptions,
} from '../../bridge/board_source'
import { connectToHost, type ConnectOptions, type HostConnection } from '../../bridge/connect'
import { HostContextProvider, useHostContext } from '../../bridge/host_context'
import { openLink } from '../../bridge/tools'
import { createYourActions } from '../../bridge/wake'
import { card } from '../../components/helpers/strings'
import { BoardView, type BoardAnnouncement } from '../../components/board/board_view/board_view'
import { announcement, type AnnouncementFact } from '../../components/helpers/announcement'
import { toBoardData } from './to_board_data'
import { useBoardMessages } from './use_board_messages'
import { useCardActions } from './use_card_actions'
import { useTaskEntry } from './use_task_entry'
import { useYourTurnActions } from './use_your_turn_actions'

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
 * The fact a card arriving in Your turn is announced as.
 */
function arrivalFact({ task, step, session, blocked }: YourTurnItem): AnnouncementFact {
  if (blocked) {
    return { kind: 'blocked', displayId: task.displayId, sessionName: session?.name }
  }
  return step.owner === 'you'
    ? { kind: 'your-step', title: task.title }
    : { kind: 'question', title: task.title, sessionName: session?.name }
}

/**
 * The sentences for the tasks a poll brought into Your turn, one per card.
 */
function arrivalAnnouncement(
  items: readonly YourTurnItem[],
  key: number
): BoardAnnouncement | null {
  const sentences = items.flatMap((item) => {
    const sentence = announcement(arrivalFact(item))
    return sentence === null ? [] : [sentence]
  })
  return sentences.length === 0 ? null : { key, text: sentences.join('. ') }
}

interface LiveBoardProps {
  app: HostConnection['app']
  source: BoardSource
}

function Board({ app, source }: LiveBoardProps) {
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

  const { messages, dismiss, reportFailure } = useBoardMessages(source)
  const taskEntry = useTaskEntry(yourActions, source, reportFailure, board.workers)
  const yourTurnActions = useYourTurnActions(yourActions, source, board, reportFailure)
  const cardActions = useCardActions(yourActions, source, board, reportFailure)
  const lists = useMemo(() => toBoardData(board), [board])
  const said = useMemo(() => arrivalAnnouncement(arrived, arrivals), [arrived, arrivals])

  async function reorder(taskId: string, position: number) {
    const item = board.queue.find((queued) => queued.task.id === taskId)
    if (!item) {
      return
    }
    setReordering(true)
    const outcome = await yourActions.reorderQueue(item.task, position)
    /* The new board first, so the queue never shows the old order between the two. */
    if (outcome.ok) {
      source.replace(outcome.props)
    }
    setReordering(false)
    if (!outcome.ok) {
      reportFailure(outcome)
    }
  }

  /** The host opens an artifact link in the browser, since the view cannot navigate. */
  async function openArtifact(url: string) {
    if (!(await openLink(app, url))) {
      reportFailure({ ok: false, refusal: card.linkNotOpened })
    }
  }

  async function queueTask(taskId: string) {
    const item = board.backlog.find((backlogged) => backlogged.task.id === taskId)
    if (!item) {
      return
    }
    const outcome = await yourActions.queueTask(item.task)
    if (outcome.ok) {
      source.replace(outcome.props)
    } else {
      reportFailure(outcome)
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
      onQueueTask={(taskId) => void queueTask(taskId)}
      onOpenLink={(url) => void openArtifact(url)}
      taskEntry={taskEntry}
      {...yourTurnActions}
      {...cardActions}
      messages={messages}
      onDismissMessage={dismiss}
    />
  )
}

/**
 * The live board: drawn from the source, which polls while it is mounted.
 * Your actions call their app-only tools and the board is redrawn from each
 * result; nothing is posted to the dedicated chat. Artifact links are opened
 * by the host. Each failure is shown in the message region.
 */
export function BoardEntry({
  connection,
  source,
}: {
  connection: HostConnection
  source: BoardSource
}) {
  return (
    <HostContextProvider store={connection.hostContext}>
      <Board app={connection.app} source={source} />
    </HostContextProvider>
  )
}
