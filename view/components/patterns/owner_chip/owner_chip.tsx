// Copied from anachoic inertia/components/patterns/owner_chip/owner_chip.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import { ownerLabel, type OwnerLabelForm } from '../../helpers/steps'
import type { Owner } from '../../types'
import styles from './owner_chip.module.css'

export const OWNER_CHIP_SIZES = ['sm', 'md'] as const

export type OwnerChipSize = (typeof OWNER_CHIP_SIZES)[number]

export interface OwnerChipProps {
  /** Who owns the step, not who it waits on. */
  owner: Owner
  /** `sm`: the chain preview. `md`: the timeline. */
  size: OwnerChipSize
  /** `generic` reads "agent" for any agent; `named` reads `sessionName`. */
  form?: OwnerLabelForm
  /** The session that holds the step, for the `named` form. */
  sessionName?: string | null
  /** Placement only. */
  className?: string
}

/**
 * Says who does a step, in one word in a hairline box. Its colors follow the
 * tone scope it sits in.
 */
export function OwnerChip({
  owner,
  size,
  form = 'generic',
  sessionName,
  className,
}: OwnerChipProps) {
  return (
    <span
      className={joinClasses(
        size === 'sm' && 'text-note',
        styles.chip,
        styles[size],
        styles[owner],
        className
      )}
    >
      {ownerLabel(owner, sessionName, form)}
    </span>
  )
}
