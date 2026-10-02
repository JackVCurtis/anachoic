import { useState, type CSSProperties, type Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { busy, card, fillTemplate, taskView } from '../../helpers/strings'
import { taskStepCounts, taskStepLabel } from '../../helpers/task_view'
import { formatDuration } from '../../helpers/time'
import { splitFacts } from '../../helpers/words'
import { BusyIndicator } from '../../patterns/busy_indicator/busy_indicator'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { StatusBadge } from '../../patterns/status_badge/status_badge'
import { Button } from '../../primitives/button/button'
import { ChainTimeline } from '../chain_timeline/chain_timeline'
import { EventList } from '../event_list/event_list'
import type { TaskSummary, TaskViewData } from '../task_data'
import styles from './task_view.module.css'

/** How the host shows the view, as far as the task view cares. */
export type TaskDisplayMode = 'inline' | 'fullscreen' | 'pip'

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface TaskViewProps {
  /** What is known of the task, enough for the header while it loads. */
  task: TaskSummary
  /** The task in full. Null while it loads. */
  data: TaskViewData | null
  /**
   * The sentence shown in place of the chain when the task can no longer be
   * shown, such as the refusal once it was archived.
   */
  archived?: string | null
  /** How the host shows the view now. */
  displayMode?: TaskDisplayMode
  /** The host can show the view in full screen. */
  fullscreenAvailable?: boolean
  /** "Open in full screen" or "Back to inline" was pressed. */
  onRequestDisplayMode?: (mode: 'inline' | 'fullscreen') => void
  /** "Back to board" was pressed. Without it the view offers no way back to the board. */
  onBackToBoard?: () => void
  /** Asks the host to open a link recorded on a step. */
  onOpenLink: (url: string) => void
  /** The host's safe-area insets, in pixels. */
  safeAreaInsets?: SafeAreaInsets | null
  /** The title, for a script that sends focus to it. */
  titleRef?: Ref<HTMLHeadingElement>
}

/** Which step the user opened, on which task. Null for none. */
interface OpenChoice {
  taskId: string
  stepId: string | null
}

/**
 * The host's safe-area insets, which the padding gives way to when they are
 * larger than it.
 */
function insetStyle(insets: SafeAreaInsets | null | undefined): CSSProperties | undefined {
  if (!insets) {
    return undefined
  }
  return {
    '--task-inset-top': `${insets.top}px`,
    '--task-inset-right': `${insets.right}px`,
    '--task-inset-bottom': `${insets.bottom}px`,
    '--task-inset-left': `${insets.left}px`,
  } as CSSProperties
}

/**
 * The facts under the title: the step counts, the agent's and the user's
 * time, and the worker the task is assigned to.
 */
function metaFacts(task: TaskSummary, data: TaskViewData | null): string[] {
  const assigned = task.assignedTo
    ? fillTemplate(card.assignedTo, { name: task.assignedTo.name })
    : ''
  if (!data) {
    return [assigned]
  }
  const agentSteps = data.steps.filter((step) => step.owner === 'agent').length
  return [
    ...splitFacts(taskStepCounts(agentSteps, data.steps.length - agentSteps)),
    fillTemplate(taskView.agentTime, { time: formatDuration(data.agentSeconds) }),
    fillTemplate(taskView.userTime, { time: formatDuration(data.yourSeconds) }),
    assigned,
  ]
}

/**
 * One task in one column: its header, its chain and its events. The open
 * step follows the chain until the user presses a step, and then stays as
 * the user left it until the view shows another task.
 */
export function TaskView({
  task,
  data,
  archived = null,
  displayMode = 'inline',
  fullscreenAvailable = false,
  onRequestDisplayMode,
  onBackToBoard,
  onOpenLink,
  safeAreaInsets,
  titleRef,
}: TaskViewProps) {
  const [choice, setChoice] = useState<OpenChoice | null>(null)
  const chosen = choice !== null && choice.taskId === task.id ? choice : null
  const currentStepId = data?.currentStepId ?? null
  const openStepId = chosen ? chosen.stepId : currentStepId

  function toggleStep(stepId: string) {
    setChoice({ taskId: task.id, stepId: openStepId === stepId ? null : stepId })
  }

  const current = data?.steps.find((step) => step.id === currentStepId)
  const stepLabel = data
    ? taskStepLabel(currentStepId === null, current?.number ?? data.steps.length, data.steps.length)
    : ''

  return (
    <div className={styles.view} style={insetStyle(safeAreaInsets)}>
      <header className={styles.header}>
        <div className={styles.top}>
          <div className={styles.identity}>
            <div className={styles.metaRow}>
              {data?.list && <StatusBadge list={data.list} />}
              <span className={joinClasses('text-mono-xs', styles.subtle)}>{task.displayId}</span>
              {stepLabel && (
                <span className={joinClasses('text-status', styles.subtle)}>{stepLabel}</span>
              )}
            </div>
            <h2
              ref={titleRef}
              tabIndex={-1}
              className={joinClasses('text-title-panel', styles.title)}
            >
              {task.title}
            </h2>
          </div>
          <DisplayControls
            displayMode={displayMode}
            fullscreenAvailable={fullscreenAvailable}
            onRequestDisplayMode={onRequestDisplayMode}
            onBackToBoard={onBackToBoard}
          />
        </div>
        <div className={styles.bottom}>
          <MetaLine tone="meta" facts={metaFacts(task, data)} className={styles.meta} />
        </div>
      </header>
      {archived ? (
        <p className={joinClasses('text-body-sm', styles.archived)}>{archived}</p>
      ) : data ? (
        <>
          <ChainTimeline
            steps={data.steps}
            currentStepId={currentStepId}
            openStepId={openStepId}
            onToggleStep={toggleStep}
            onOpenLink={onOpenLink}
          />
          {data.events.length > 0 && <EventList events={data.events} />}
        </>
      ) : (
        <BusyIndicator label={busy.loadingTask} />
      )}
    </div>
  )
}

interface DisplayControlsProps {
  displayMode: TaskDisplayMode
  fullscreenAvailable: boolean
  onRequestDisplayMode?: (mode: 'inline' | 'fullscreen') => void
  onBackToBoard?: () => void
}

/**
 * Back to the board, and in or out of full screen, each only where it can act.
 */
function DisplayControls({
  displayMode,
  fullscreenAvailable,
  onRequestDisplayMode,
  onBackToBoard,
}: DisplayControlsProps) {
  const toFullscreen = onRequestDisplayMode && fullscreenAvailable && displayMode === 'inline'
  const toInline = onRequestDisplayMode && displayMode === 'fullscreen'
  if (!onBackToBoard && !toFullscreen && !toInline) {
    return null
  }

  return (
    <div className={styles.controls}>
      {onBackToBoard && (
        <Button variant="secondary" size="sm" onPress={onBackToBoard}>
          {taskView.backToBoard}
        </Button>
      )}
      {toFullscreen && (
        <Button variant="secondary" size="sm" onPress={() => onRequestDisplayMode('fullscreen')}>
          {taskView.openInFullScreen}
        </Button>
      )}
      {toInline && (
        <Button variant="secondary" size="sm" onPress={() => onRequestDisplayMode('inline')}>
          {taskView.backToInline}
        </Button>
      )}
    </div>
  )
}
