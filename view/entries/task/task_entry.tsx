import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { formatTaskId } from '../../../shared/task_id'
import { connectToHost, type ConnectOptions, type HostConnection } from '../../bridge/connect'
import { HostContextProvider, useHostContext } from '../../bridge/host_context'
import { openTaskSource, type TaskSource } from '../../bridge/task_source'
import { openLink, requestDisplayMode } from '../../bridge/tools'
import { createYourActions } from '../../bridge/wake'
import { card } from '../../components/helpers/strings'
import type { TaskSummary } from '../../components/task/task_data'
import { TaskView } from '../../components/task/task_view/task_view'
import { toTaskData } from '../board/to_task_data'
import { useMessages } from '../board/use_board_messages'
import { useTaskActions } from '../board/use_task_actions'

export interface LoadedTask {
  connection: HostConnection
  /** The task the replayed open_task result names, by number. */
  taskId: string
  source: TaskSource
}

/**
 * The task id from the replayed open_task result, which may arrive during
 * the handshake or just after it.
 */
function replayedTaskId(connection: HostConnection, arrived: Promise<string>): Promise<string> {
  const known = connection.replayedTaskId()
  return known === undefined ? arrived : Promise.resolve(known)
}

/**
 * Connects to the host, takes only the task id from the replayed tool
 * result, and fetches the task with get_task, since the result may be old.
 * When the host offers full screen and shows the view inline, it asks for
 * full screen.
 */
export async function loadTask(options: ConnectOptions = {}): Promise<LoadedTask> {
  let named: (taskId: string) => void = () => {}
  const arrived = new Promise<string>((resolve) => {
    named = resolve
  })
  const connection = await connectToHost({
    ...options,
    onReplayedTaskId: (taskId) => {
      named(taskId)
      options.onReplayedTaskId?.(taskId)
    },
  })
  const { displayMode, availableDisplayModes } = connection.hostContext.getSnapshot()
  if (availableDisplayModes?.includes('fullscreen') && displayMode !== 'fullscreen') {
    void requestDisplayMode(connection.app, 'fullscreen')
  }
  const taskId = await replayedTaskId(connection, arrived)
  const source = await openTaskSource(connection.app, taskId)
  return { connection, taskId, source }
}

/**
 * What the header shows when get_task refused the task before it was ever
 * drawn: only its id.
 */
function summaryOf(taskId: string): TaskSummary {
  const number = Number(taskId)
  const displayId = Number.isSafeInteger(number) && number > 0 ? formatTaskId(number) : taskId
  return { id: taskId, displayId, title: displayId, assignedTo: null }
}

interface LiveTaskProps {
  app: HostConnection['app']
  taskId: string
  source: TaskSource
}

function Task({ app, taskId, source }: LiveTaskProps) {
  const { displayMode, availableDisplayModes, safeAreaInsets } = useHostContext()
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot)
  const data = useMemo(() => (snapshot.task ? toTaskData(snapshot.task) : null), [snapshot.task])
  const task = data?.task ?? summaryOf(taskId)
  const yourActions = useMemo(() => createYourActions(app), [app])
  const { messages, dismiss, reportFailure } = useMessages()
  const actions = useTaskActions(yourActions, task, source, { onFailure: reportFailure })

  /** The host opens a step's link in the browser, since the view cannot navigate. */
  async function open(url: string) {
    if (!(await openLink(app, url))) {
      reportFailure({ ok: false, refusal: card.linkNotOpened })
    }
  }

  useEffect(() => {
    source.start()
    return () => source.stop()
  }, [source])

  return (
    <TaskView
      task={task}
      data={data}
      archived={snapshot.refusal}
      displayMode={displayMode}
      fullscreenAvailable={availableDisplayModes?.includes('fullscreen') ?? false}
      onRequestDisplayMode={(mode) => void requestDisplayMode(app, mode)}
      onOpenLink={(url) => void open(url)}
      safeAreaInsets={safeAreaInsets}
      onPark={actions.onPark}
      onArchive={actions.onArchive}
      pending={actions.pending}
      messages={messages}
      onDismissMessage={dismiss}
    />
  )
}

/**
 * The live task view that open_task renders: drawn from the task source,
 * which polls get_task while it is mounted. It posts nothing to the chat.
 * Park and Archive call their tools and the view fetches the task again, so
 * an archived task shows that it was archived; a refusal shows in the view.
 * Step links are opened by the host, and the view moves between inline and
 * full screen through the host.
 */
export function TaskEntry({ connection, taskId, source }: LoadedTask) {
  return (
    <HostContextProvider store={connection.hostContext}>
      <Task app={connection.app} taskId={taskId} source={source} />
    </HostContextProvider>
  )
}
