// Copied from anachoic inertia/components/patterns/flash_message/flash_messages.tsx at fd99e0d
import type { RefObject } from 'react'
import { FlashMessage, type FlashMessageData } from './flash_message'

export interface FlashMessagesProps {
  /** None, one or two. */
  messages: readonly FlashMessageData[]
  onDismiss: (id: string) => void
  /** Where focus goes when a strip is dismissed from the keyboard. */
  focusTarget?: RefObject<HTMLElement | null>
}

/**
 * One strip per message, errors drawn above successes. Messages of one kind
 * keep the order they were given in.
 */
export function FlashMessages({ messages, onDismiss, focusTarget }: FlashMessagesProps) {
  const errors = messages.filter((message) => message.kind === 'error')
  const successes = messages.filter((message) => message.kind === 'success')

  /*
   * Keyed by kind and place, not by id: a message that replaces one of its
   * kind reuses the strip, and its live region announces the new words.
   */
  return [...errors, ...successes].map((message, index) => (
    <FlashMessage
      key={`${message.kind}-${message.kind === 'error' ? index : index - errors.length}`}
      {...message}
      onDismiss={onDismiss}
      focusTarget={focusTarget}
    />
  ))
}
