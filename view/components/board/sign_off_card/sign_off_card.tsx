import { joinClasses } from '../../helpers/join_classes'
import { done, fillTemplate } from '../../helpers/strings'
import { formatDuration, formatFinished } from '../../helpers/time'
import { plural } from '../../helpers/words'
import { LABEL_TICK, useNow, useTimeZone } from '../../hooks/use_now/use_now'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { Frame } from '../../primitives/frame/frame'
import type { SignOffTask } from '../board_data'
import styles from './sign_off_card.module.css'

export interface SignOffCardProps {
  task: SignOffTask
  onOpenTask: (taskId: string) => void
}

/**
 * The stats line: "agent 14m · you 6m · 2 links".
 */
function signOffStats({ agentSeconds, yourSeconds, linkCount }: SignOffTask): string[] {
  return [
    fillTemplate(done.agentTime, { time: formatDuration(agentSeconds) }),
    fillTemplate(done.yourTime, { time: formatDuration(yourSeconds) }),
    fillTemplate(done.links, { 'n links': plural(linkCount, 'link') }),
  ]
}

/**
 * One finished task that waits for your sign-off, with when it finished and
 * the time it took. The card as a whole is not clickable; its title is.
 */
export function SignOffCard({ task, onOpenTask }: SignOffCardProps) {
  const now = useNow(LABEL_TICK.finished)
  const timeZone = useTimeZone()

  return (
    <Frame element="article" className={styles.card}>
      <div className={styles.head}>
        <p className={styles.meta}>
          <span className={joinClasses('text-mono-xs', styles.id)}>{task.task.displayId}</span>
          <span className={joinClasses('text-status', styles.finished)}>
            {fillTemplate(done.finished, {
              when: formatFinished(task.finishedAt, now, timeZone),
            })}
          </span>
        </p>
        <h3 className={styles.heading}>
          <button
            type="button"
            onClick={() => onOpenTask(task.task.id)}
            className={joinClasses('text-title-5', styles.title)}
          >
            {task.task.title}
          </button>
        </h3>
        <MetaLine tone="detail" facts={signOffStats(task)} />
      </div>
    </Frame>
  )
}
