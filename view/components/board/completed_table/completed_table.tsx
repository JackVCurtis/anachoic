// Copied from anachoic inertia/components/completed/completed_table/completed_table.tsx at fd99e0d
import { stepCount, timesCell } from '../../helpers/history'
import { joinClasses } from '../../helpers/join_classes'
import { assistive, history } from '../../helpers/strings'
import { formatSignedOff } from '../../helpers/time'
import { LABEL_TICK, useNow, useTimeZone } from '../../hooks/use_now/use_now'
import { StepPips } from '../../patterns/step_pips/step_pips'
import { DataTable, type DataTableColumn } from '../../primitives/data_table/data_table'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import { ArtifactLinks } from '../artifact_links/artifact_links'
import type { CompletedTask } from '../board_data'
import { pipsOf } from '../pips'
import styles from './completed_table.module.css'

export const COMPLETED_COLUMNS: readonly DataTableColumn[] = [
  { id: 'task', label: history.columnTask, width: '40%' },
  { id: 'steps', label: history.columnSteps },
  { id: 'times', label: history.columnTimes },
  { id: 'workers', label: history.columnWorkers },
  { id: 'artifacts', label: history.columnArtifacts },
  { id: 'signed-off', label: history.columnSignedOff },
]

export interface CompletedTableProps {
  /** Most recently signed off first. */
  tasks: readonly CompletedTask[]
  onOpenTask: (taskId: string) => void
  /** Asks the host to open an artifact link. */
  onOpenLink: (url: string) => void
  /** Placement only. */
  className?: string
}

/**
 * A cell with nothing to show: a dash, heard as "none".
 */
function NoneCell() {
  return (
    <>
      <span aria-hidden="true">{history.noneCell}</span>
      <VisuallyHidden>{assistive.none}</VisuallyHidden>
    </>
  )
}

/**
 * A plain record of what was signed off. The title button opens the task;
 * an artifact link asks the host to open it. The row itself does nothing,
 * so a press on a link never opens the task too.
 */
export function CompletedTable({ tasks, onOpenTask, onOpenLink, className }: CompletedTableProps) {
  const now = useNow(LABEL_TICK.finished)
  const timeZone = useTimeZone()

  return (
    <DataTable columns={COMPLETED_COLUMNS} label={history.title} className={className}>
      {tasks.map((row) => (
        <tr key={row.task.id}>
          <td>
            <span className={joinClasses('text-mono-xs', styles.id)}>{row.task.displayId}</span>
            <button type="button" className={styles.title} onClick={() => onOpenTask(row.task.id)}>
              {row.task.title}
            </button>
          </td>
          <td className={styles.faint}>
            <span className={styles.steps}>{stepCount(row.steps.length)}</span>
            <StepPips steps={pipsOf(row.steps)} className={styles.pips} />
          </td>
          <td className={joinClasses(styles.faint, styles.nowrap)}>
            {timesCell(row.agentSeconds, row.userSeconds)}
          </td>
          <td className={styles.faint}>
            {row.workers.length === 0 ? (
              <NoneCell />
            ) : (
              <ul className={styles.workers}>
                {row.workers.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </td>
          <td className={styles.artifacts}>
            {row.artifacts.length === 0 ? (
              <span className={styles.faint}>
                <NoneCell />
              </span>
            ) : (
              <ArtifactLinks artifacts={row.artifacts} onOpenLink={onOpenLink} />
            )}
          </td>
          <td className={joinClasses(styles.faint, styles.nowrap)}>
            {formatSignedOff(row.signedOffAt, now, timeZone)}
          </td>
        </tr>
      ))}
    </DataTable>
  )
}
