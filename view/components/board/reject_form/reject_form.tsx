import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { reject } from '../../helpers/strings'
import { useEscapeLayer } from '../../hooks/use_escape_layer/use_escape_layer'
import { Button } from '../../primitives/button/button'
import { TextArea } from '../../primitives/text_area/text_area'
import styles from './reject_form.module.css'

/** The longest rejection note the tools take, as shared/limits.ts sets it. */
const NOTE_MAX = 2000

/** The inverted buttons have one size; on a Done card they match its small actions. */
const SEND_LOOK = {
  inverse: { variant: 'inverse-solid' },
  plain: { variant: 'primary', size: 'sm' },
} as const

const CANCEL_LOOK = {
  inverse: { variant: 'inverse-outline' },
  plain: { variant: 'ghost', size: 'sm' },
} as const

export interface RejectFormProps {
  /** `inverse` on a Waiting on user card, `plain` on a Done card. */
  tone: 'inverse' | 'plain'
  /** The rejection is in flight. */
  busy?: boolean
  /** "Send back", with the note trimmed. */
  onSend: (note: string) => void
  onCancel: () => void
  /** The control that opened the form, which takes focus back when it is cancelled. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * Sends the agent step whose output waits on the user back to the agent: a
 * required note on what was wrong, "Send back" and "Cancel". The note field
 * takes focus when the form appears, and Escape cancels.
 */
export function RejectForm({
  tone,
  busy = false,
  onSend,
  onCancel,
  returnFocusTo,
}: RejectFormProps) {
  const labelId = useId()
  const noteId = useId()
  const field = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const empty = text.trim() === ''
  const inverse = tone === 'inverse'

  const cancelled = useRef(false)

  function returnFocus() {
    returnFocusTo?.current?.focus()
  }

  const returnFocusAfterClose = useEffectEvent(returnFocus)

  function cancel() {
    if (busy) {
      return
    }
    cancelled.current = true
    onCancel()
    returnFocus()
  }

  useEscapeLayer(cancel)

  useEffect(() => {
    field.current?.focus()
    /* The parent usually mounts the opener again in the commit that hides the form, so focus moves once more after it. */
    return () => {
      if (cancelled.current) {
        returnFocusAfterClose()
      }
    }
  }, [])

  function send(event: FormEvent) {
    event.preventDefault()
    if (!empty && !busy) {
      onSend(text.trim())
    }
  }

  return (
    <form
      data-raised
      className={joinClasses(styles.form, inverse && styles.inverse)}
      onSubmit={send}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        }
      }}
    >
      <div className={styles.header}>
        <span id={labelId} className={joinClasses('text-label', styles.label)}>
          {reject.label}
        </span>
        <span id={noteId} className={joinClasses('text-hint', styles.hint)}>
          {empty ? reject.needsNote : reject.redoes}
        </span>
      </div>
      <TextArea
        ref={field}
        labelledBy={labelId}
        describedBy={noteId}
        required
        minHeight={64}
        value={text}
        placeholder={reject.placeholder}
        onChange={(next) => setText(next.slice(0, NOTE_MAX))}
      />
      <div className={styles.buttons}>
        <Button type="submit" {...SEND_LOOK[tone]} busy={busy} disabled={empty && !busy}>
          {reject.sendBack}
        </Button>
        <Button {...CANCEL_LOOK[tone]} disabled={busy} onPress={cancel}>
          {reject.cancel}
        </Button>
      </div>
    </form>
  )
}
