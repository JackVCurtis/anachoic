import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { HostApp } from '../../bridge/connect'
import { useHostContext } from '../../bridge/host_context'
import { requestDisplayMode } from '../../bridge/tools'
import { TaskView } from '../../components/task/task_view/task_view'
import { toTaskData } from './to_task_data'
import type { OpenTaskPanel } from './use_task_panel'

export interface TaskPanelProps {
  app: Pick<HostApp, 'requestDisplayMode'>
  panel: OpenTaskPanel
  onBackToBoard: () => void
  onOpenLink: (url: string) => void
}

/**
 * The task the board swapped to, drawn from its task source. While it loads,
 * the header shows what the card knew. It opens scrolled to the top, with
 * focus on the task's title.
 */
export function TaskPanel({ app, panel, onBackToBoard, onOpenLink }: TaskPanelProps) {
  const { displayMode, availableDisplayModes, safeAreaInsets } = useHostContext()
  const snapshot = useSyncExternalStore(panel.source.subscribe, panel.source.getSnapshot)
  const data = useMemo(() => (snapshot.task ? toTaskData(snapshot.task) : null), [snapshot.task])
  const title = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    title.current?.focus({ preventScroll: true })
  }, [panel.source])

  return (
    <TaskView
      task={data?.task ?? panel.summary}
      data={data}
      archived={snapshot.refusal}
      displayMode={displayMode}
      fullscreenAvailable={availableDisplayModes?.includes('fullscreen') ?? false}
      onRequestDisplayMode={(mode) => void requestDisplayMode(app, mode)}
      onBackToBoard={onBackToBoard}
      onOpenLink={onOpenLink}
      safeAreaInsets={safeAreaInsets}
      titleRef={title}
    />
  )
}
