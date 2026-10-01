// Copied from anachoic inertia/components/primitives/button/button.tsx at fd99e0d
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { Icon, type IconName } from '../icon/icon'
import styles from './button.module.css'

export type LightButtonVariant = 'primary' | 'secondary' | 'ghost' | 'utility'

export type InverseButtonVariant = 'inverse-solid' | 'inverse-outline'

export type ButtonVariant = LightButtonVariant | InverseButtonVariant

export type ButtonSize = 'md' | 'sm'

export type ButtonType = 'button' | 'submit'

export const BUTTON_VARIANTS: readonly ButtonVariant[] = [
  'primary',
  'secondary',
  'ghost',
  'utility',
  'inverse-solid',
  'inverse-outline',
]

/**
 * The sizes each variant is drawn at. The inverted buttons have one size.
 */
export const BUTTON_SIZES: Readonly<Record<ButtonVariant, readonly ButtonSize[]>> = {
  'primary': ['md', 'sm'],
  'secondary': ['md', 'sm'],
  'ghost': ['md', 'sm'],
  'utility': ['md', 'sm'],
  'inverse-solid': ['md'],
  'inverse-outline': ['md'],
}

type NativeAttributes = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'className' | 'style' | 'type' | 'disabled' | 'onClick' | 'aria-busy'
>

export interface ButtonBaseProps extends NativeAttributes {
  /** Full width of the parent. */
  block?: boolean
  /** Takes the free space in a row. */
  stretch?: boolean
  /** A leading icon, before the label. */
  icon?: IconName
  type?: ButtonType
  disabled?: boolean
  /** Looks disabled and ignores presses, keeps its label and its focus. */
  busy?: boolean
  onPress?: () => void
  /** Placement only. Never color, border or type. */
  className?: string
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

export type ButtonProps = ButtonBaseProps &
  (
    | { variant?: LightButtonVariant; size?: ButtonSize }
    | { variant: InverseButtonVariant; size?: 'md' }
  )

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  'primary': styles.primary,
  'secondary': styles.secondary,
  'ghost': styles.ghost,
  'utility': styles.utility,
  'inverse-solid': styles.inverseSolid,
  'inverse-outline': styles.inverseOutline,
}

/**
 * The push button. It is always a native `button`.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  stretch = false,
  icon,
  type = 'button',
  disabled = false,
  busy = false,
  onPress,
  className,
  children,
  ...attributes
}: ButtonProps) {
  const inert = disabled || busy

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inert) {
      event.preventDefault()
      return
    }
    onPress?.()
  }

  return (
    <button
      {...attributes}
      type={type}
      disabled={disabled}
      aria-disabled={busy && !disabled ? true : undefined}
      aria-busy={busy ? true : undefined}
      onClick={handleClick}
      className={joinClasses(
        styles.button,
        VARIANT_CLASSES[variant],
        size === 'sm' && styles.small,
        block && styles.block,
        stretch && styles.stretch,
        className
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}
