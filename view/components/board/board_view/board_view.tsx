import { useRef, type CSSProperties } from 'react'
import type { FollowUpInput } from '../../helpers/follow_up'
import { assistive } from '../../helpers/strings'
import type { FlashMessageData } from '../../patterns/flash_message/flash_message'
import { FlashMessages } from '../../patterns/flash_message/flash_messages'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardData, PendingCardAction } from '../board_data'
import { BacklogSection } from '../backlog_section/backlog_section'
import { BoardHeader } from '../board_header/board_header'
import { DoneSection } from '../done_section/done_section'
import { QueueSection } from '../queue_section/queue_section'
import { SessionsSection } from '../sessions_section/sessions_section'
import { TaskEntry, type TaskEntryProps } from '../task_entry/task_entry'
import { WorkingSection } from '../working_section/working_section'
import type { YourTurnCardProps, YourTurnPending } from '../your_turn_card/your_turn_card'
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
  /** "Move to backlog" on a Queue card. Without it no Queue card offers the button. */
  onMoveToBacklog?: (taskId: string) => void
  /** "Sign off" on a Done card. Without it no Done card offers the button. */
  onSignOff?: (taskId: string) => void
  /** "Append & queue" in a follow-up composer. Without it no Done card offers "Follow up". */
  onFollowUp?: (taskId: string, followUp: FollowUpInput) => void
  /** A confirmed "Archive" on a Backlog or Done card. Without it no card offers the button. */
  onArchive?: (taskId: string) => void
  /** The card action in flight, if any. */
  pending?: PendingCardAction | null
  /** Asks the host to open an artifact link. Without it no card draws its links. */
  onOpenLink?: (url: string) => void
  /** "Remove" on a worker's card in Sessions. Without it no card offers the button. */
  onRemoveSession?: (sessionId: string) => void
  /** The session whose removal is in flight, if any. */
  removingSessionId?: string | null
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

/** Your actions on the Your turn cards. Without one, no card offers it. */
export interface BoardViewYourTurn extends Pick<
  YourTurnCardProps,
  'onCompleteStep' | 'onAnswer' | 'onPark'
> {
  /** The Your turn action in flight, if any. */
  yourTurnPending?: YourTurnPending | null
}

export interface BoardViewMessages {
  /** What went wrong with your last actions: none, or one of each kind. */
  messages?: readonly FlashMessageData[]
  onDismissMessage?: (id: string) => void
}

export type BoardViewProps = BoardData &
  BoardViewActions &
  BoardViewAnnouncement &
  BoardViewMessages &
  BoardViewYourTurn

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
  onMoveToBacklog,
  onSignOff,
  onFollowUp,
  onArchive,
  pending = null,
  onOpenLink,
  onRemoveSession,
  removingSessionId = null,
  announcement = null,
  messages = [],
  onDismissMessage = ignore,
  onCompleteStep,
  onAnswer,
  onPark,
  yourTurnPending = null,
}: BoardViewProps) {
  const heading = useRef<HTMLHeadingElement>(null)

  return (
    <div className={styles.board} style={insetStyle(safeAreaInsets)}>
      <VisuallyHidden element="h1" ref={heading} tabIndex={-1}>
        {assistive.boardTitle}
      </VisuallyHidden>
      <BoardHeader counts={counts} updatedAt={updatedAt} unreachable={unreachable} />
      <section aria-label={assistive.landmarkMessages} className={styles.messages}>
        <FlashMessages messages={messages} onDismiss={onDismissMessage} focusTarget={heading} />
      </section>
      <div className={styles.entry}>{taskEntry && <TaskEntry {...taskEntry} />}</div>
      <YourTurnSection
        tasks={yourTurnTasks}
        onOpenTask={onOpenTask}
        onCompleteStep={onCompleteStep}
        onAnswer={onAnswer}
        onPark={onPark}
        onOpenLink={onOpenLink}
        pending={yourTurnPending}
      />
      <SessionsSection
        sessions={sessionList}
        onOpenTask={onOpenTask}
        onRemoveSession={onRemoveSession}
        removingSessionId={removingSessionId}
      />
      <WorkingSection tasks={workingTasks} onOpenTask={onOpenTask} onOpenLink={onOpenLink} />
      <QueueSection
        tasks={queueTasks}
        busy={reordering}
        selectedTaskId={selectedTaskId}
        onOpenTask={onOpenTask}
        onReorder={onReorder}
        onMoveToBacklog={onMoveToBacklog}
        pending={pending}
        onOpenLink={onOpenLink}
      />
      <BacklogSection
        tasks={backlogTasks}
        selectedTaskId={selectedTaskId}
        onOpenTask={onOpenTask}
        onQueueTask={onQueueTask}
        onArchive={onArchive}
        pending={pending}
        onOpenLink={onOpenLink}
      />
      <DoneSection
        toSignOff={toSignOff}
        signedOff={signedOff}
        onOpenTask={onOpenTask}
        onSignOff={onSignOff}
        onFollowUp={onFollowUp}
        onArchive={onArchive}
        pending={pending}
        onOpenLink={onOpenLink}
      />
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {announcement && <span key={announcement.key}>{announcement.text}</span>}
      </VisuallyHidden>
    </div>
  )
}
