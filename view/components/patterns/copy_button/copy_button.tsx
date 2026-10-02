// Copied from anachoic inertia/components/patterns/copy_button/copy_button.tsx at fd99e0d
import { Fragment, useEffect, useState } from 'react'
import { COPIED_MS } from '../../helpers/constants'
import { Button } from '../../primitives/button/button'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'

/**
 * `command` is the utility button inside a command box. `all` is the
 * secondary button in the Your turn header.
 */
export type CopyButtonUse = 'command' | 'all'

export interface CopyButtonProps {
  /** Written to the clipboard exactly as given. */
  text: string
  /** The resting label: "Copy" or "Copy all commands". */
  label: string
  /** The label for COPIED_MS after a copy succeeds: "Copied" or "Copied all". */
  confirmedLabel: string
  use?: CopyButtonUse
  /** Called after each copy that succeeds. */
  onCopied?: () => void
  /** Placement only. */
  className?: string
}

/**
 * Copies its text to the clipboard. After a copy succeeds it reads the
 * confirmed label for COPIED_MS, and a polite live region says it. Each
 * button keeps its own state; a failed copy changes nothing.
 */
export function CopyButton({
  text,
  label,
  confirmedLabel,
  use = 'command',
  onCopied,
  className,
}: CopyButtonProps) {
  /** Successful copies so far. Each one restarts the delay and is announced again. */
  const [copies, setCopies] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (copies === 0) {
      return
    }
    const timer = setTimeout(() => setConfirmed(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copies])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setConfirmed(true)
    setCopies((count) => count + 1)
    onCopied?.()
  }

  return (
    <>
      <Button
        variant={use === 'command' ? 'utility' : 'secondary'}
        size="sm"
        className={className}
        onPress={() => void copy()}
      >
        {confirmed ? confirmedLabel : label}
      </Button>
      <VisuallyHidden role="status" aria-live="polite">
        {/* A new key remounts the words, so a second copy is announced again. */}
        {confirmed && <Fragment key={copies}>{confirmedLabel}</Fragment>}
      </VisuallyHidden>
    </>
  )
}
