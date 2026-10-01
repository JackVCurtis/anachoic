// Copied from anachoic inertia/components/primitives/icon_button/icon_button.tsx at fd99e0d
import type { ButtonHTMLAttributes, Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './icon_button.module.css'

type NativeAttributes = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'className' | 'style' | 'type' | 'onClick' | 'aria-label' | 'aria-labelledby'
>

export interface IconButtonProps extends NativeAttributes {
  /** One character, such as `×`. It is hidden from assistive technology. */
  'glyph': string
  /** The button's only name. */
  'aria-label': string
  'onPress'?: () => void
  /** Placement only. */
  'className'?: string
  'ref'?: Ref<HTMLButtonElement>
}

/**
 * A square button that holds one glyph, in the secondary button's look.
 */
export function IconButton({ glyph, onPress, className, ...attributes }: IconButtonProps) {
  return (
    <button
      {...attributes}
      type="button"
      onClick={() => onPress?.()}
      className={joinClasses(styles.iconButton, className)}
    >
      <span aria-hidden="true" className={styles.glyph}>
        {glyph}
      </span>
    </button>
  )
}
