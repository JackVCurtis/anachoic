import { joinClasses } from '../../helpers/join_classes'
import { events as words, fillTemplate, taskView } from '../../helpers/strings'
import { formatEventTime } from '../../helpers/time'
import { LABEL_TICK, useNow, useTimeZone } from '../../hooks/use_now/use_now'
import { SectionHeader } from '../../patterns/section_header/section_header'
import type { TaskEventData } from '../task_data'
import styles from './event_list.module.css'

export interface EventListProps {
  /** Oldest first. */
  events: readonly TaskEventData[]
}

/**
 * Who caused an event: its session's name, or the user.
 */
function causedBy(event: TaskEventData): string {
  return event.sessionName ?? words.byUser
}

/**
 * The task's events in time order, oldest first: when, what, the step it
 * names, who caused it, and its detail.
 */
export function EventList({ events }: EventListProps) {
  const now = useNow(LABEL_TICK.eventTime)
  const timeZone = useTimeZone()

  return (
    <section className={styles.section}>
      <SectionHeader headingLevel={3} size="sm" title={taskView.events} className={styles.header} />
      <ol className={styles.list}>
        {events.map((event) => (
          <li key={event.id} className={styles.row}>
            <time dateTime={event.at} className={joinClasses('text-mono-xs', styles.time)}>
              {formatEventTime(event.at, now, timeZone)}
            </time>
            <span className={styles.what}>
              <span className={styles.kind}>{words.kinds[event.kind]}</span>
              {event.stepNumber !== null && event.stepNumber !== undefined && (
                <> {fillTemplate(words.step, { n: event.stepNumber })}</>
              )}
              <span className={styles.by}> · {causedBy(event)}</span>
              {event.detail && <span className={styles.detail}> {event.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
