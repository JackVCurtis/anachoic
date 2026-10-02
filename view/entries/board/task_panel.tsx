import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ActionResult } from '../../../shared/props'
import type { HostApp } from '../../bridge/connect'
import { useHostContext } from '../../bridge/host_context'
import { openLink, requestDisplayMode } from '../../bridge/tools'
import type { YourActions } from '../../bridge/wake'
import { card } from '../../components/helpers/strings'
import { TaskView } from '../../components/task/task_view/task_view'
import { toTaskData } from './to_task_data'
import { useMessages } from './use_board_messages'
import { useTaskActions } from './use_task_actions'
import type { OpenTaskPanel, ReturnSection } from './use_task_panel'

export interface TaskPanelProps {
  app: Pick<HostApp, 'requestDisplayMode' | 'openLink'>
  yourActions: Pick<YourActions, 'moveToBacklog' | 'archiveTask'>
  panel: OpenTaskPanel
  /** Draws the fresh board an action returned, behind the panel. */
  onBoard: (props: ActionResult) => void
  /** Swaps back to the board, with focus on a section's heading when one is given. */
  onBackToBoard: (section?: ReturnSection | null) => void
  /** The way back's label, for a panel opened from somewhere else. "Back to board" unless given. */
  backLabel?: string
}

/**
 * The task the board swapped to, drawn from its task source. While it loads,
 * the header shows what the card knew. It opens scrolled to the top, with
 * focus on the task's title. Park keeps the panel on the task; Archive
 * returns to the board, with focus on the Backlog or Done heading.
 */
export function TaskPanel({
  app,
  yourActions,
  panel,
  onBoard,
  onBackToBoard,
  backLabel,
}: TaskPanelProps) {
  const { displayMode, availableDisplayModes, safeAreaInsets } = useHostContext()
  const snapshot = useSyncExternalStore(panel.source.subscribe, panel.source.getSnapshot)
  const data = useMemo(() => (snapshot.task ? toTaskData(snapshot.task) : null), [snapshot.task])
  const title = useRef<HTMLHeadingElement>(null)
  const { messages, dismiss, reportFailure } = useMessages()
  const list = data?.list ?? null
  const actions = useTaskActions(yourActions, panel.summary, panel.source, {
    onBoard,
    onArchived: () => onBackToBoard(list === 'backlog' ? 'backlog' : 'done'),
    onFailure: reportFailure,
  })

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    title.current?.focus({ preventScroll: true })
  }, [panel.source])

  /** The host opens a step's link in the browser, since the view cannot navigate. */
  async function open(url: string) {
    if (!(await openLink(app, url))) {
      reportFailure({ ok: false, refusal: card.linkNotOpened })
    }
  }

  return (
    <TaskView
      task={data?.task ?? panel.summary}
      data={data}
      archived={snapshot.refusal}
      displayMode={displayMode}
      fullscreenAvailable={availableDisplayModes?.includes('fullscreen') ?? false}
      onRequestDisplayMode={(mode) => void requestDisplayMode(app, mode)}
      onBackToBoard={() => onBackToBoard()}
      backLabel={backLabel}
      onOpenLink={(url) => void open(url)}
      safeAreaInsets={safeAreaInsets}
      titleRef={title}
      onPark={actions.onPark}
      onArchive={actions.onArchive}
      pending={actions.pending}
      messages={messages}
      onDismissMessage={dismiss}
    />
  )
}
