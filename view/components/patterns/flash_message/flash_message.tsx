// Copied from anachoic inertia/components/patterns/flash_message/flash_message.tsx at fd99e0d
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FocusEvent,
  type RefObject,
} from 'react'
import { FLASH_MS } from '../../helpers/constants'
import { joinClasses } from '../../helpers/join_classes'
import { flashWord, type FlashKind } from '../../helpers/messages'
import { message as words } from '../../helpers/strings'
import { Button } from '../../primitives/button/button'
import styles from './flash_message.module.css'

export interface FlashMessageData {
  id: string
  kind: FlashKind
  /** The server's text, shown as given. */
  text: string
}

export interface FlashMessageProps extends FlashMessageData {
  onDismiss: (id: string) => void
  /**
   * Where focus goes when the strip is dismissed from the keyboard: the
   * content region, or the task title in the drawer.
   */
  focusTarget?: RefObject<HTMLElement | null>
}

/**
 * The strip that shows what the server said about the last action. A success
 * leaves by itself after FLASH_MS unless the pointer or focus holds it; an
 * error stays until dismissed.
 */
export function FlashMessage({ id, kind, text, onDismiss, focusTarget }: FlashMessageProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused
  /** The time left on the count of the message with this id. */
  const count = useRef({ id, remaining: FLASH_MS })
  const dismissed = useRef<string | null>(null)
  const pressedByPointer = useRef(false)

  /** The button and the timer may both fire for one message; it is dismissed once. */
  function dismiss() {
    if (dismissed.current === id) {
      return
    }
    dismissed.current = id
    onDismiss(id)
  }

  const timeOut = useEffectEvent(dismiss)

  useEffect(() => {
    if (count.current.id !== id) {
      count.current = { id, remaining: FLASH_MS }
    }
    if (kind !== 'success' || paused) {
      return
    }
    const startedAt = Date.now()
    const timer = setTimeout(timeOut, count.current.remaining)
    return () => {
      clearTimeout(timer)
      if (count.current.id === id) {
        count.current.remaining -= Date.now() - startedAt
      }
    }
  }, [id, kind, paused])

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocused(false)
    }
  }

  function handlePress() {
    const fromKeyboard = !pressedByPointer.current
    pressedByPointer.current = false
    if (fromKeyboard) {
      focusTarget?.current?.focus()
    }
    dismiss()
  }

  return (
    <div
      className={joinClasses(styles.strip, kind === 'success' ? styles.success : styles.error)}
      data-kind={kind}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
    >
      <div role={kind === 'success' ? 'status' : 'alert'} className={styles.announced}>
        {/* A new id remounts the words, so the region announces them again even when unchanged. */}
        <Fragment key={id}>
          <span className={joinClasses('text-section', styles.word)}>{flashWord(kind)}</span>{' '}
          <span className={joinClasses('text-body-sm', styles.text)}>{text}</span>
        </Fragment>
      </div>
      <Button
        variant="utility"
        size="sm"
        onPointerDown={() => {
          pressedByPointer.current = true
        }}
        onKeyDown={() => {
          pressedByPointer.current = false
        }}
        onPress={handlePress}
      >
        {words.dismiss}
      </Button>
    </div>
  )
}
