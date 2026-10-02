// Copied from anachoic inertia/components/sign_off/sign_off_view/sign_off_view.tsx at fd99e0d
import { useState } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { done, fillTemplate } from '../../helpers/strings'
import { formatFinished } from '../../helpers/time'
import { plural } from '../../helpers/words'
import { LABEL_TICK, useNow, useTimeZone } from '../../hooks/use_now/use_now'
import { Disclosure } from '../../patterns/disclosure/disclosure'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { SignedOffTask, SignOffTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { SignOffCard } from '../sign_off_card/sign_off_card'
import styles from './done_section.module.css'

/**
 * The most signed-off tasks the board lists.
 */
const SIGNED_OFF_SHOWN = 10

export interface DoneSectionProps {
  /** The finished tasks that wait for your sign-off, in the server's order. */
  toSignOff: readonly SignOffTask[]
  /** The most recently signed off first. */
  signedOff: readonly SignedOffTask[]
  onOpenTask: (taskId: string) => void
}

/**
 * The tasks to sign off, counted in the header, then the most recently
 * signed-off tasks folded under a Disclosure that starts closed.
 */
export function DoneSection({ toSignOff, signedOff, onOpenTask }: DoneSectionProps) {
  const [open, setOpen] = useState(false)
  const recent = signedOff.slice(0, SIGNED_OFF_SHOWN)

  return (
    <BoardSection
      title={done.title}
      count={toSignOff.length}
      empty={<EmptyState variant="framed" message={done.nothingToSignOff} />}
      cards={toSignOff.map((task) => ({
        id: task.task.id,
        card: <SignOffCard task={task} onOpenTask={onOpenTask} />,
      }))}
      footer={
        recent.length > 0 && (
          <Disclosure
            open={open}
            onToggle={() => setOpen(!open)}
            toggle={fillTemplate(done.signedOffCount, { 'n tasks': plural(recent.length, 'task') })}
            toggleVariant="utility"
            toggleSize="sm"
            toggleClassName={styles.toggle}
          >
            <ul className={styles.signedOff}>
              {recent.map((task) => (
                <li key={task.task.id}>
                  <SignedOffRow task={task} onOpenTask={onOpenTask} />
                </li>
              ))}
            </ul>
          </Disclosure>
        )
      }
    />
  )
}

function SignedOffRow({
  task,
  onOpenTask,
}: {
  task: SignedOffTask
  onOpenTask: (taskId: string) => void
}) {
  const now = useNow(LABEL_TICK.finished)
  const timeZone = useTimeZone()

  return (
    <div className={styles.row}>
      <span className={joinClasses('text-mono-xs', styles.id)}>{task.task.displayId}</span>
      <button
        type="button"
        onClick={() => onOpenTask(task.task.id)}
        className={joinClasses('text-body-sm', styles.title)}
      >
        {task.task.title}
      </button>
      <span className={joinClasses('text-status', styles.when)}>
        {formatFinished(task.signedOffAt, now, timeZone)}
      </span>
    </div>
  )
}
