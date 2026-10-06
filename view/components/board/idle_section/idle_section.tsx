// Copied from anachoic inertia/components/board/agents_section/agents_section.tsx at fd99e0d
import { sessions as strings } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { BoardSession } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { SessionCard } from '../session_card/session_card'
import styles from './idle_section.module.css'

export interface IdleSectionProps {
  /** The live sessions and those that ended in the last 10 minutes, in the server's order. */
  sessions: readonly BoardSession[]
  onOpenTask: (taskId: string) => void
  /** Removes a worker. Without it no card offers "Remove". */
  onRemoveSession?: (sessionId: string) => void
  /** The session whose removal is in flight, if any. */
  removingSessionId?: string | null
}

/**
 * Each live session that holds no step, in the server's order, counted in the
 * header, then the sessions that ended recently with what they released. A
 * session holding a step shows in Working or Waiting on user instead. When a
 * card that held focus is removed, focus goes to the section's heading.
 */
export function IdleSection({
  sessions,
  onOpenTask,
  onRemoveSession,
  removingSessionId = null,
}: IdleSectionProps) {
  const idle = sessions.filter((session) => session.live && !session.holding)
  const ended = sessions.filter((session) => !session.live)

  function card(session: BoardSession) {
    return (
      <SessionCard
        session={session}
        onOpenTask={onOpenTask}
        onRemove={onRemoveSession}
        removing={removingSessionId === session.id}
      />
    )
  }

  return (
    <BoardSection
      title={strings.idleTitle}
      count={idle.length}
      empty={<EmptyState variant="dashed" message={strings.nothingIdle} />}
      cards={idle.map((session) => ({
        id: session.id,
        card: card(session),
      }))}
      footer={
        ended.length > 0 && (
          <ul className={styles.ended}>
            {ended.map((session) => (
              <li key={session.id} data-card>
                {card(session)}
              </li>
            ))}
          </ul>
        )
      }
    />
  )
}
