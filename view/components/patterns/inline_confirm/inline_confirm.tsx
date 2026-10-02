// Copied from anachoic inertia/components/patterns/inline_confirm/inline_confirm.tsx at fd99e0d
import { useEffect, useEffectEvent, useId, useRef, useState, type RefObject } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { useEscapeLayer } from '../../hooks/use_escape_layer/use_escape_layer'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import styles from './inline_confirm.module.css'

export type InlineConfirmLayout = 'row' | 'stack'

export interface InlineConfirmProps {
  /** A full sentence or two, ending with a full stop. */
  question: string
  confirmLabel: string
  dismissLabel: string
  /** `row` for a header, `stack` for a narrow place such as an agent card. */
  layout?: InlineConfirmLayout
  /** The confirmed action is in flight. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  /**
   * The control that opened the question, which takes focus back when it is
   * dismissed. Without it, focus goes back to what held it when the question
   * appeared.
   */
  returnFocusTo?: RefObject<HTMLElement | null>
}

function focusable(element: Element | null | undefined): element is HTMLElement {
  return element instanceof HTMLElement && element.isConnected && element !== document.body
}

/**
 * A question asked in place, with a button that confirms and one that
 * dismisses. The dismiss button takes focus when it appears.
 */
export function InlineConfirm({
  question,
  confirmLabel,
  dismissLabel,
  layout = 'row',
  busy = false,
  onConfirm,
  onCancel,
  returnFocusTo,
}: InlineConfirmProps) {
  const questionId = useId()
  const frame = useRef<HTMLDivElement>(null)
  const dismiss = useRef<HTMLButtonElement>(null)
  /** Read while rendering the first time, before the opener can be disabled or removed. */
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const dismissed = useRef(false)

  function returnFocus() {
    const target = returnFocusTo?.current ?? opener
    if (focusable(target)) {
      target.focus()
    }
  }

  const returnFocusAfterClose = useEffectEvent(returnFocus)

  function cancel() {
    if (busy) {
      return
    }
    dismissed.current = true
    onCancel()
    returnFocus()
  }

  const cancelOnEscape = useEffectEvent(cancel)

  /* Inside the task drawer, Escape pressed anywhere in the drawer dismisses the question first. */
  useEscapeLayer(cancel)

  useEffect(() => {
    dismiss.current?.focus()
    /*
     * The parent usually hides the question in answer to onCancel, and the
     * opener may only be enabled or mounted again in that same commit, so
     * focus is moved once more after it.
     */
    return () => {
      if (dismissed.current) {
        returnFocusAfterClose()
      }
    }
  }, [])

  /*
   * A native listener on the frame runs before any listener on an ancestor,
   * including React's own at the root, so a surrounding dialog or drawer never
   * sees this Escape.
   */
  useEffect(() => {
    const element = frame.current
    if (!element) {
      return
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      cancelOnEscape()
    }
    element.addEventListener('keydown', handleKeyDown)
    return () => element.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div ref={frame} role="group" aria-labelledby={questionId}>
      <Frame
        fill="tint"
        emphasis="selected"
        className={joinClasses(
          'text-body-sm',
          styles.confirm,
          layout === 'row' ? styles.row : styles.stack
        )}
        data-layout={layout}
      >
        <p id={questionId} className={styles.question}>
          {question}
        </p>
        <div className={styles.buttons}>
          <Button
            variant="primary"
            size={layout === 'row' ? 'md' : 'sm'}
            busy={busy}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            ref={dismiss}
            variant="ghost"
            size={layout === 'row' ? 'md' : 'sm'}
            disabled={busy}
            onPress={cancel}
          >
            {dismissLabel}
          </Button>
        </div>
      </Frame>
    </div>
  )
}
