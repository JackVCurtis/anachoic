// Copied from anachoic inertia/components/primitives/select/select.tsx at fd99e0d
import type { Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { Icon } from '../icon/icon'
import type { TextFieldName } from '../text_input/text_input'
import styles from './select.module.css'

export interface SelectOption {
  value: string
  label: string
}

export type SelectProps = TextFieldName & {
  options: readonly SelectOption[]
  /** The value of the selected option. */
  value: string
  /** Called with the value of the option chosen. */
  onChange: (value: string) => void
  disabled?: boolean
  /** The id of the note that describes the field. */
  describedBy?: string
  id?: string
  name?: string
  ref?: Ref<HTMLSelectElement>
  /** Placement only. Never color, border or type. */
  className?: string
}

/**
 * The browser's own select, drawn as a text field with a chevron at its right
 * edge. The list that opens and the keyboard are the browser's. Light surface
 * only.
 */
export function Select({
  options,
  value,
  onChange,
  disabled,
  describedBy,
  id,
  name,
  ref,
  className,
  label,
  labelledBy,
}: SelectProps) {
  return (
    <div className={joinClasses(styles.control, disabled && styles.disabled, className)}>
      <select
        id={id}
        name={name}
        ref={ref}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={styles.select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} className={styles.chevron} />
    </div>
  )
}
