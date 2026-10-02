// Copied from anachoic inertia/components/board/agents_section/agents_section.tsx at fd99e0d
import { sessions as strings } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { BoardSession } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { SessionCard } from '../session_card/session_card'
import styles from './sessions_section.module.css'

export interface SessionsSectionProps {
  /** The live sessions and those that ended in the last 10 minutes, in the server's order. */
  sessions: readonly BoardSession[]
  onOpenTask: (taskId: string) => void
  /** Removes a worker. Without it no card offers "Remove". */
  onRemoveSession?: (sessionId: string) => void
  /** The session whose removal is in flight, if any. */
  removingSessionId?: string | null
}

/**
 * Each live session in the server's order, counted in the header, then the
 * sessions that ended recently with what they released. When a card that
 * held focus is removed, focus goes to the section's heading.
 */
export function SessionsSection({
  sessions,
  onOpenTask,
  onRemoveSession,
  removingSessionId = null,
}: SessionsSectionProps) {
  const live = sessions.filter((session) => session.live)
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
      title={strings.title}
      count={live.length}
      empty={<EmptyState variant="dashed" message={strings.nothingLive} />}
      cards={live.map((session) => ({
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
