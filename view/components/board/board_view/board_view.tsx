import type { CSSProperties } from 'react'
import { assistive } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardData } from '../board_data'
import { BacklogSection } from '../backlog_section/backlog_section'
import { BoardHeader } from '../board_header/board_header'
import { DoneSection } from '../done_section/done_section'
import { QueueSection } from '../queue_section/queue_section'
import { SessionsSection } from '../sessions_section/sessions_section'
import { TaskEntry, type TaskEntryProps } from '../task_entry/task_entry'
import { WorkingSection } from '../working_section/working_section'
import { YourTurnSection } from '../your_turn_section/your_turn_section'
import styles from './board_view.module.css'

export interface BoardViewActions {
  /** A card's title was pressed. Nothing happens until the board has a task panel. */
  onOpenTask?: (taskId: string) => void
  /** "Queue →" was pressed. Without it no Backlog card offers the button. */
  onQueueTask?: (taskId: string) => void
  /** A Queue card was dropped in a new place. Without it no Queue card has a Move handle. */
  onReorder?: (taskId: string, position: number) => void
  /** A change of the Queue's order is in flight. */
  reordering?: boolean
  /** The task open in the task panel, so its card shows as selected. */
  selectedTaskId?: string | null
  /** Task entry, below the messages. Without it the board offers no "Add task". */
  taskEntry?: TaskEntryProps
}

/**
 * What the polite live region says. A new key says the text again, even when
 * it is the same as before.
 */
export interface BoardAnnouncement {
  key: number
  text: string
}

export interface BoardViewAnnouncement {
  announcement?: BoardAnnouncement | null
}

export type BoardViewProps = BoardData & BoardViewActions & BoardViewAnnouncement

function ignore() {}

/**
 * The host's safe-area insets, which the padding gives way to when they are
 * larger than it.
 */
function insetStyle(insets: BoardData['safeAreaInsets']): CSSProperties | undefined {
  if (!insets) {
    return undefined
  }
  return {
    '--board-inset-top': `${insets.top}px`,
    '--board-inset-right': `${insets.right}px`,
    '--board-inset-bottom': `${insets.bottom}px`,
    '--board-inset-left': `${insets.left}px`,
  } as CSSProperties
}

/**
 * The board: one column, as tall as its content, with the header, the
 * messages, task entry and then each section in turn.
 */
export function BoardView({
  yourTurn: yourTurnTasks,
  working: workingTasks,
  queue: queueTasks,
  backlog: backlogTasks,
  toSignOff,
  signedOff,
  sessions: sessionList,
  counts,
  updatedAt,
  unreachable,
  safeAreaInsets,
  onOpenTask = ignore,
  onQueueTask,
  onReorder,
  reordering = false,
  selectedTaskId = null,
  taskEntry,
  announcement = null,
}: BoardViewProps) {
  return (
    <div className={styles.board} style={insetStyle(safeAreaInsets)}>
      <VisuallyHidden element="h1">{assistive.boardTitle}</VisuallyHidden>
      <BoardHeader counts={counts} updatedAt={updatedAt} unreachable={unreachable} />
      <section aria-label={assistive.landmarkMessages} className={styles.messages} />
      <div className={styles.entry}>{taskEntry && <TaskEntry {...taskEntry} />}</div>
      <YourTurnSection tasks={yourTurnTasks} onOpenTask={onOpenTask} />
      <SessionsSection sessions={sessionList} onOpenTask={onOpenTask} />
      <WorkingSection tasks={workingTasks} onOpenTask={onOpenTask} />
      <QueueSection
        tasks={queueTasks}
        busy={reordering}
        selectedTaskId={selectedTaskId}
        onOpenTask={onOpenTask}
        onReorder={onReorder}
      />
      <BacklogSection
        tasks={backlogTasks}
        selectedTaskId={selectedTaskId}
        onOpenTask={onOpenTask}
        onQueueTask={onQueueTask}
      />
      <DoneSection toSignOff={toSignOff} signedOff={signedOff} onOpenTask={onOpenTask} />
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {announcement && <span key={announcement.key}>{announcement.text}</span>}
      </VisuallyHidden>
    </div>
  )
}
