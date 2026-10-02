import type { CSSProperties } from 'react'
import { assistive, done } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import { Frame } from '../../primitives/frame/frame'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardData, BoardTask } from '../board_data'
import { BacklogSection } from '../backlog_section/backlog_section'
import { BoardHeader } from '../board_header/board_header'
import { BoardSection } from '../board_section/board_section'
import { QueueSection } from '../queue_section/queue_section'
import { SessionsSection } from '../sessions_section/sessions_section'
import { WorkingSection } from '../working_section/working_section'
import { YourTurnSection } from '../your_turn_section/your_turn_section'
import styles from './board_view.module.css'

export interface BoardViewActions {
  /** A card's title was pressed. Nothing happens until the board has a task panel. */
  onOpenTask?: (taskId: string) => void
  /** "Queue →" was pressed. Without it no Backlog card offers the button. */
  onQueueTask?: (taskId: string) => void
  /** The task open in the task panel, so its card shows as selected. */
  selectedTaskId?: string | null
}

export type BoardViewProps = BoardData & BoardViewActions

function ignore() {}

/**
 * A task as one line, until each section draws its own cards.
 */
function TaskLine({ task }: { task: BoardTask }) {
  return (
    <Frame className={styles.line}>
      <span className="text-name">{task.displayId}</span>{' '}
      <span className="text-body-sm">{task.title}</span>
    </Frame>
  )
}

function taskLines(items: ReadonlyArray<{ task: BoardTask }>) {
  return items.map(({ task }) => ({ id: task.id, card: <TaskLine task={task} /> }))
}

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
  sessions: sessionList,
  counts,
  updated,
  unreachable,
  safeAreaInsets,
  onOpenTask = ignore,
  onQueueTask,
  selectedTaskId = null,
}: BoardViewProps) {
  return (
    <div className={styles.board} style={insetStyle(safeAreaInsets)}>
      <VisuallyHidden element="h1">{assistive.boardTitle}</VisuallyHidden>
      <BoardHeader counts={counts} updated={updated} unreachable={unreachable} />
      <section aria-label={assistive.landmarkMessages} className={styles.messages} />
      <div className={styles.entry} />
      <YourTurnSection tasks={yourTurnTasks} onOpenTask={onOpenTask} />
      <SessionsSection sessions={sessionList} onOpenTask={onOpenTask} />
      <WorkingSection tasks={workingTasks} onOpenTask={onOpenTask} />
      <QueueSection tasks={queueTasks} selectedTaskId={selectedTaskId} onOpenTask={onOpenTask} />
      <BacklogSection
        tasks={backlogTasks}
        selectedTaskId={selectedTaskId}
        onOpenTask={onOpenTask}
        onQueueTask={onQueueTask}
      />
      <BoardSection
        title={done.title}
        count={toSignOff.length}
        cards={taskLines(toSignOff)}
        empty={<EmptyState variant="dashed" message={done.nothingToSignOff} />}
      />
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {null}
      </VisuallyHidden>
    </div>
  )
}
