import { useEffect, useId, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { canAppendFollowUp, followUpNote, type FollowUpDraft } from '../../helpers/follow_up'
import { joinClasses } from '../../helpers/join_classes'
import { done } from '../../helpers/strings'
import { SectionHeader } from '../../patterns/section_header/section_header'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import { ChainComposer } from '../chain_composer/chain_composer'
import { PlacementField } from '../placement_field/placement_field'
import styles from './follow_up_composer.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

export interface FollowUpComposerProps {
  draft: FollowUpDraft
  /** The number of steps already in the task's chain. The new ones number on after them. */
  chainLength: number
  /** The follow-up is being appended. */
  busy?: boolean
  onDraftChange: (draft: FollowUpDraft) => void
  onAppend: () => void
  /** "Cancel" or Escape. */
  onCancel: () => void
}

/**
 * Appends steps to a finished task and sends it back to the Queue, at the
 * back or the front. The steps are written as in task entry. The draft
 * belongs to the parent.
 */
export function FollowUpComposer({
  draft,
  chainLength,
  busy = false,
  onDraftChange,
  onAppend,
  onCancel,
}: FollowUpComposerProps) {
  const titleId = useId()
  const noteId = useId()
  const form = useRef<HTMLFormElement>(null)
  const ready = canAppendFollowUp(draft)

  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (ready && !busy) {
      onAppend()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <Frame fill="tint" emphasis="selected" className={styles.frame}>
      <form
        ref={form}
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className={styles.form}
      >
        <SectionHeader level="label" accent title={done.followUpTitle} titleId={titleId} />
        <ChainComposer
          steps={draft.steps}
          firstNumber={chainLength + 1}
          onChange={(steps) => onDraftChange({ ...draft, steps })}
        />
        <PlacementField
          placement={draft.placement}
          disabled={busy}
          onChange={(placement) => onDraftChange({ ...draft, placement })}
        />
        <div className={styles.buttons}>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            busy={busy}
            disabled={!ready && !busy}
            aria-describedby={noteId}
          >
            {done.appendAndQueue}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onPress={onCancel}>
            {done.cancel}
          </Button>
          <p id={noteId} aria-live="polite" className={joinClasses('text-hint', styles.note)}>
            <SymbolText>{followUpNote(draft)}</SymbolText>
          </p>
        </div>
      </form>
    </Frame>
  )
}
