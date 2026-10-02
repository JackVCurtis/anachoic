// Copied from anachoic inertia/components/primitives/text_input/text_input.tsx at fd99e0d
import type { ChangeEvent, KeyboardEvent, Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './text_input.module.css'

/**
 * `field` is `--tone-field-bg`. `ground` is `--color-bg`, for a field that has
 * to stand out from a tinted frame on the light surface.
 */
export type TextFieldFill = 'field' | 'ground'

/**
 * A field's accessible name: its own words, or the id of the visible label
 * that names it. A placeholder is never a name, so one of the two is required.
 */
export type TextFieldName =
  { label: string; labelledBy?: never } | { labelledBy: string; label?: never }

/**
 * What TextInput and TextArea share, for the element `E` they render.
 */
export interface TextFieldBaseProps<E extends HTMLInputElement | HTMLTextAreaElement> {
  value: string
  /** Called with the whole new text on every edit. */
  onChange: (text: string) => void
  /** Passed through untouched, so a parent can bind Enter or Shift+Enter. */
  onKeyDown?: (event: KeyboardEvent<E>) => void
  placeholder?: string
  fill?: TextFieldFill
  disabled?: boolean
  /** Sets `aria-invalid`. The look does not change; the describing note explains. */
  invalid?: boolean
  /** Sets `aria-required`, for a field its form cannot go without. */
  required?: boolean
  /** The id of the note that describes the field. */
  describedBy?: string
  id?: string
  name?: string
  ref?: Ref<E>
  /** Placement only. Never color, border or type. */
  className?: string
}

export type TextInputProps = TextFieldBaseProps<HTMLInputElement> & TextFieldName

/**
 * The attributes a text field element takes from the shared props.
 */
export function textFieldAttributes<E extends HTMLInputElement | HTMLTextAreaElement>({
  value,
  onChange,
  onKeyDown,
  placeholder,
  fill = 'field',
  disabled,
  invalid,
  required,
  describedBy,
  id,
  name,
  ref,
  className,
  label,
  labelledBy,
}: TextFieldBaseProps<E> & TextFieldName) {
  return {
    id,
    name,
    ref,
    value,
    placeholder,
    disabled,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? true : undefined,
    'aria-required': required ? true : undefined,
    'onChange': (event: ChangeEvent<E>) => onChange(event.target.value),
    onKeyDown,
    'className': joinClasses(styles.field, fill === 'ground' && styles.ground, className),
  }
}

/**
 * A one-line text field.
 */
export function TextInput(props: TextInputProps) {
  return <input type="text" {...textFieldAttributes(props)} />
}
