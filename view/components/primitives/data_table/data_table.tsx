// Copied from anachoic inertia/components/primitives/data_table/data_table.tsx at fd99e0d
import type { ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './data_table.module.css'

export interface DataTableColumn {
  id: string
  /** Sentence case. The header cell makes it uppercase. */
  label: string
  /** A CSS width for the column, such as "40%". */
  width?: string
}

export interface DataTableProps {
  columns: readonly DataTableColumn[]
  /** The body rows: native `tr` elements of `td` cells, one per column. */
  children?: ReactNode
  /** The table's name, when no visible heading names it. */
  label?: string
  /** The id of the heading that names the table. */
  labelledBy?: string
  /** Placement only. Never color, border or type. */
  className?: string
}

/**
 * The themed native table. The header is drawn from the columns; the body
 * rows are the parent's own, and pick up the cell padding, rules and hover.
 */
export function DataTable({ columns, children, label, labelledBy, className }: DataTableProps) {
  return (
    <table
      className={joinClasses(styles.table, className)}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} scope="col" style={{ width: column.width }}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}
