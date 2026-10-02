import type { CSSProperties } from 'react'
import { assistive, backlog, done, queue, sessions, working } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import { Frame } from '../../primitives/frame/frame'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardData, BoardTask } from '../board_data'
import { BoardHeader } from '../board_header/board_header'
import { BoardSection } from '../board_section/board_section'
import { YourTurnSection } from '../your_turn_section/your_turn_section'
import styles from './board_view.module.css'

export interface BoardViewActions {
  /** A card's title was pressed. Nothing happens until the board has a task panel. */
  onOpenTask?: (taskId: string) => void
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
}: BoardViewProps) {
  return (
    <div className={styles.board} style={insetStyle(safeAreaInsets)}>
      <VisuallyHidden element="h1">{assistive.boardTitle}</VisuallyHidden>
      <BoardHeader counts={counts} updated={updated} unreachable={unreachable} />
      <section aria-label={assistive.landmarkMessages} className={styles.messages} />
      <div className={styles.entry} />
      <YourTurnSection tasks={yourTurnTasks} onOpenTask={onOpenTask} />
      <BoardSection
        title={sessions.title}
        count={sessionList.length}
        cards={sessionList.map(({ id, name }) => ({
          id,
          card: (
            <Frame className={styles.line}>
              <span className="text-name">{name}</span>
            </Frame>
          ),
        }))}
        empty={<EmptyState variant="dashed" message={sessions.nothingLive} />}
      />
      <BoardSection
        title={working.title}
        count={workingTasks.length}
        cards={taskLines(workingTasks)}
        empty={<EmptyState variant="dashed" message={working.nothingWorking} />}
      />
      <BoardSection
        title={queue.title}
        count={queueTasks.length}
        cards={taskLines(queueTasks)}
        folds={false}
        listElement="ol"
      />
      <BoardSection
        title={backlog.title}
        count={backlogTasks.length}
        cards={taskLines(backlogTasks)}
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
