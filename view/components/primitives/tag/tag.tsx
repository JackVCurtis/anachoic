// Copied from anachoic inertia/components/primitives/tag/tag.tsx at fd99e0d
import type { ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './tag.module.css'

export const TAG_VARIANTS = ['outline', 'accent', 'neutral'] as const

export type TagVariant = (typeof TAG_VARIANTS)[number]

export const TAG_TYPES = ['label', 'count'] as const

export type TagType = (typeof TAG_TYPES)[number]

export interface TagProps {
  /** `outline`: an accent border. `accent` and `neutral`: a tinted fill. */
  variant: TagVariant
  /** `label`: heading type in capitals. `count`: body type. */
  type?: TagType
  children: ReactNode
  /** Placement only. */
  className?: string
}

/**
 * A small label in a box: a workflow name, Draft, an artifact count.
 */
export function Tag({ variant, type = 'label', children, className }: TagProps) {
  return (
    <span className={joinClasses(styles.tag, styles[type], styles[variant], className)}>
      {children}
    </span>
  )
}
