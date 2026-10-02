import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ActionResult } from '../../../shared/props'
import type { HostApp } from '../../bridge/connect'
import { useHostContext } from '../../bridge/host_context'
import type { HistoryQuery, HistorySource } from '../../bridge/history_source'
import { createTaskSource } from '../../bridge/task_source'
import { openLink } from '../../bridge/tools'
import type { YourActions } from '../../bridge/wake'
import { HistoryView } from '../../components/board/history_view/history_view'
import { card, history } from '../../components/helpers/strings'
import { useMessages } from '../board/use_board_messages'
import { TaskPanel } from '../board/task_panel'
import { toTaskSummary } from '../board/to_task_data'
import type { OpenTaskPanel } from '../board/use_task_panel'
import { toHistoryPage } from './to_history_data'

export interface HistoryPanelProps {
  app: Pick<HostApp, 'callServerTool' | 'openLink' | 'requestDisplayMode'>
  yourActions: Pick<YourActions, 'moveToBacklog' | 'archiveTask'>
  /** Polled while the panel is mounted. */
  source: HistorySource
  /** The filter the field starts with. */
  filter?: string
  /** "Back to board" was pressed. Without it the panel offers no way back. */
  onBackToBoard?: () => void
  /** Sends focus to the History title when the panel first shows. */
  focusOnShow?: boolean
  /** Draws the fresh board an action in the task panel returned. */
  onBoard?: (props: ActionResult) => void
}

function focusable(element: HTMLElement | null | undefined): element is HTMLElement {
  return element !== null && element !== undefined && element.isConnected
}

function ignore() {}

/**
 * The History view drawn from its source, which polls get_history while the
 * panel is mounted. Pages and filters are fetched through the source. A
 * title swaps the history for the task, in the board's task panel, and
 * "Back to history" swaps back with focus on the title that opened it.
 * Artifact links are opened by the host; nothing is posted to the chat.
 */
export function HistoryPanel({
  app,
  yourActions,
  source,
  filter = '',
  onBackToBoard,
  focusOnShow = false,
  onBoard = ignore,
}: HistoryPanelProps) {
  const { safeAreaInsets } = useHostContext()
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot)
  const page = useMemo(
    () => (snapshot.history ? toHistoryPage(snapshot.history) : null),
    [snapshot.history]
  )
  const [busy, setBusy] = useState(false)
  const [task, setTask] = useState<OpenTaskPanel | null>(null)
  const returning = useRef<OpenTaskPanel | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const { messages, show, dismiss, reportFailure } = useMessages()

  useEffect(() => {
    source.start()
    return () => source.stop()
  }, [source])

  /* A refusal get_history gives is shown once for each new sentence. */
  useEffect(() => {
    let seen: string | null = null
    const report = () => {
      const { refusal } = source.getSnapshot()
      if (refusal !== seen) {
        seen = refusal
        if (refusal !== null) {
          show('error', refusal)
        }
      }
    }
    report()
    return source.subscribe(report)
  }, [source, show])

  const taskSource = task?.source
  useEffect(() => {
    if (!taskSource) {
      return
    }
    /* Started first: starting bumps the source's generation, which would drop the fetch's refusal. */
    taskSource.start()
    void taskSource.refresh()
    return () => taskSource.stop()
  }, [taskSource])

  /* Runs once the history is shown again, since a hidden element cannot take focus. */
  useLayoutEffect(() => {
    const closed = returning.current
    if (task !== null || closed === null) {
      return
    }
    returning.current = null
    const title = root.current?.querySelector<HTMLElement>('h1')
    ;[closed.opener, title].find(focusable)?.focus()
  }, [task])

  async function fetch(query: Partial<HistoryQuery>) {
    setBusy(true)
    await source.show(query)
    setBusy(false)
  }

  function openTask(taskId: string) {
    const row = snapshot.history?.rows.find((each) => each.task.id === taskId)
    if (!row) {
      return
    }
    const active = document.activeElement
    setTask({
      summary: toTaskSummary(row.task),
      source: createTaskSource(app, taskId),
      opener: active instanceof HTMLElement && active !== document.body ? active : null,
      sectionHeading: null,
    })
  }

  function backToHistory() {
    returning.current = task
    setTask(null)
    void source.refresh()
  }

  /** The host opens an artifact link in the browser, since the view cannot navigate. */
  async function openArtifact(url: string) {
    if (!(await openLink(app, url))) {
      reportFailure({ ok: false, refusal: card.linkNotOpened })
    }
  }

  /*
   * The history stays mounted, hidden, while the task panel shows, so the
   * title that opened the task can take focus back and the filter keeps its
   * text.
   */
  return (
    <>
      <div ref={root} hidden={task !== null}>
        <HistoryView
          history={page}
          filter={filter}
          busy={busy}
          onPageChange={(next) => void fetch({ page: next })}
          onFilterChange={(next) => void fetch({ page: 1, filter: next })}
          onOpenTask={openTask}
          onOpenLink={(url) => void openArtifact(url)}
          onBackToBoard={onBackToBoard}
          messages={messages}
          onDismissMessage={dismiss}
          safeAreaInsets={safeAreaInsets}
          focusOnShow={focusOnShow}
        />
      </div>
      {task && (
        <TaskPanel
          app={app}
          yourActions={yourActions}
          panel={task}
          onBoard={onBoard}
          onBackToBoard={backToHistory}
          backLabel={history.backToHistory}
        />
      )}
    </>
  )
}
