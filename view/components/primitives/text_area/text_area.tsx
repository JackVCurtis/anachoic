// Copied from anachoic inertia/components/primitives/text_area/text_area.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import {
  textFieldAttributes,
  type TextFieldBaseProps,
  type TextFieldName,
} from '../text_input/text_input'
import styles from './text_area.module.css'

export type TextAreaProps = TextFieldBaseProps<HTMLTextAreaElement> &
  TextFieldName & {
    /** The least height in pixels, set by the parent: 76 in task entry, 64 in the follow-up composer and the deny form, 72 in the chat composer. */
    minHeight: number
  }

/**
 * A multi-line text field. It looks like TextInput, at 13px, and resizes
 * vertically only.
 */
export function TextArea({ minHeight, className, ...props }: TextAreaProps) {
  const attributes = textFieldAttributes<HTMLTextAreaElement>({
    ...props,
    className: joinClasses(styles.area, className),
  })
  return <textarea {...attributes} style={{ minHeight: `${minHeight}px` }} />
}
