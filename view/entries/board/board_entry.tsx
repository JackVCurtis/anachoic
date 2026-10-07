import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import type { YourTurnItem } from '../../../shared/props'
import {
  openBoardSource,
  type BoardSource,
  type BoardSourceOptions,
} from '../../bridge/board_source'
import { connectToHost, type ConnectOptions, type HostConnection } from '../../bridge/connect'
import { createHistorySource, type HistorySource } from '../../bridge/history_source'
import { HostContextProvider, useHostContext } from '../../bridge/host_context'
import { getBoard, openLink } from '../../bridge/tools'
import { createYourActions } from '../../bridge/wake'
import { card } from '../../components/helpers/strings'
import { BoardView, type BoardAnnouncement } from '../../components/board/board_view/board_view'
import { announcement, type AnnouncementFact } from '../../components/helpers/announcement'
import type { TaskEntryDraft } from '../../components/helpers/task_entry'
import { HistoryPanel } from '../history/history_panel'
import { TaskPanel } from './task_panel'
import { toBoardData } from './to_board_data'
import { useBoardMessages } from './use_board_messages'
import { useCardActions } from './use_card_actions'
import { useRemoveSession } from './use_remove_session'
import { useTaskEntry } from './use_task_entry'
import { useTaskPanel } from './use_task_panel'
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
 * The fact a card arriving in Waiting on user is announced as.
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
 * The sentences for the tasks a poll brought into Waiting on user, one per card.
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

/**
 * The board's History panel: "Show all completed tasks" swaps the board for
 * the history, fetched with get_history and kept live by polling it. "Back
 * to board" swaps back, fetches the board, and returns focus to the link,
 * else the board's heading. `closeHistory` swaps back without moving focus.
 */
function useHistoryPanel(
  app: HostConnection['app'],
  boardSource: Pick<BoardSource, 'replace'>,
  boardRoot: RefObject<HTMLElement | null>
) {
  const [historySource, setHistorySource] = useState<HistorySource | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const returning = useRef(false)

  /* Runs once the board is shown again, since a hidden element cannot take focus. */
  useLayoutEffect(() => {
    if (historySource !== null || !returning.current) {
      return
    }
    returning.current = false
    const target = opener.current?.isConnected
      ? opener.current
      : boardRoot.current?.querySelector<HTMLElement>('h1')
    target?.focus()
  }, [historySource, boardRoot])

  function showHistory() {
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
    const history = createHistorySource(app)
    setHistorySource(history)
    void history.refresh()
  }

  async function backFromHistory(restoreFocus: boolean) {
    returning.current = restoreFocus
    setHistorySource(null)
    const outcome = await getBoard(app)
    if (outcome.ok && !('changed' in outcome.props)) {
      boardSource.replace(outcome.props)
    }
  }

  return {
    historySource,
    showHistory,
    backFromHistory: () => void backFromHistory(true),
    closeHistory: () => {
      if (historySource !== null) {
        void backFromHistory(false)
      }
    },
  }
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
  const { taskEntry, fill: fillTaskEntry } = useTaskEntry(
    yourActions,
    source,
    reportFailure,
    board.workers
  )
  const yourTurnActions = useYourTurnActions(yourActions, source, board, reportFailure)
  const cardActions = useCardActions(yourActions, source, board, reportFailure)
  const removeSession = useRemoveSession(yourActions, source, reportFailure)
  const lists = useMemo(() => toBoardData(board), [board])
  const said = useMemo(() => arrivalAnnouncement(arrived, arrivals), [arrived, arrivals])
  const boardRoot = useRef<HTMLDivElement>(null)
  const { panel, openTask, backToBoard, closeTask } = useTaskPanel(app, board, source, boardRoot)
  const { historySource, showHistory, backFromHistory, closeHistory } = useHistoryPanel(
    app,
    source,
    boardRoot
  )
  const [clones, setClones] = useState(0)

  /* Runs once the board is shown again, so the filled task entry is in view. */
  useLayoutEffect(() => {
    if (clones > 0) {
      window.scrollTo(0, 0)
    }
  }, [clones])

  /** Swaps back to the board, from the task panel or the history, with the copy in task entry. */
  function cloneTask(draft: TaskEntryDraft) {
    closeTask()
    closeHistory()
    fillTaskEntry(draft)
    setClones((count) => count + 1)
  }

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

  /*
   * The board stays mounted, hidden, while the task panel shows, so the card
   * that opened the task can take focus back.
   */
  return (
    <>
      <div ref={boardRoot} hidden={panel !== null || historySource !== null}>
        <BoardView
          {...lists}
          updatedAt={updatedAt}
          unreachable={unreachable}
          safeAreaInsets={safeAreaInsets}
          announcement={said}
          onReorder={(taskId, position) => void reorder(taskId, position)}
          reordering={reordering}
          workers={board.workers}
          onOpenLink={(url) => void openArtifact(url)}
          taskEntry={taskEntry}
          {...yourTurnActions}
          {...cardActions}
          {...removeSession}
          messages={messages}
          onDismissMessage={dismiss}
          onOpenTask={openTask}
          selectedTaskId={panel?.summary.id ?? null}
          onShowHistory={showHistory}
        />
      </div>
      {historySource && (
        <HistoryPanel
          app={app}
          yourActions={yourActions}
          source={historySource}
          onBackToBoard={backFromHistory}
          focusOnShow
          onBoard={(props) => source.replace(props)}
          onClone={cloneTask}
        />
      )}
      {panel && (
        <TaskPanel
          app={app}
          yourActions={yourActions}
          panel={panel}
          onBoard={(props) => source.replace(props)}
          onBackToBoard={backToBoard}
          onClone={cloneTask}
        />
      )}
    </>
  )
}

/**
 * The live board: drawn from the source, which polls while it is mounted.
 * Your actions call their app-only tools and the board is redrawn from each
 * result; nothing is posted to the dedicated chat. Artifact links are opened
 * by the host. Each failure is shown in the message region. A card's title
 * swaps the board for its task, in the same frame. Clone task in the task
 * panel swaps back to the top of the board, with task entry holding a copy.
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
