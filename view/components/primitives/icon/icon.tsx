// Copied from anachoic inertia/components/primitives/icon/icon.tsx at fd99e0d
import { ChevronDown, Lock, Plus, Terminal, Workflow, type LucideIcon } from 'lucide-react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './icon.module.css'

/**
 * Every icon the product uses. Adding one is a deliberate edit here and in
 * docs/architecture/07-ui-port.md.
 */
const ICONS = {
  'workflow': Workflow,
  'terminal': Terminal,
  'plus': Plus,
  'lock': Lock,
  'chevron-down': ChevronDown,
} as const satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export type IconSize = 12 | 13 | 14 | 15

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export const ICON_SIZES: readonly IconSize[] = [12, 13, 14, 15]

export interface IconProps {
  name: IconName
  size: IconSize
  /** Placement only. */
  className?: string
}

/**
 * One Lucide icon at stroke-width 1.5, in the color of the text around it.
 * It is hidden from assistive technology, so it is never the only content of
 * a control: a label, a title or a value always stands beside it.
 */
export function Icon({ name, size, className }: IconProps) {
  const Glyph = ICONS[name]
  return (
    <Glyph
      size={size}
      strokeWidth={1.5}
      color="currentColor"
      aria-hidden="true"
      focusable="false"
      className={joinClasses(styles.icon, className)}
    />
  )
}
