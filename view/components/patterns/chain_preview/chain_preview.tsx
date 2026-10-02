// Copied from anachoic inertia/components/patterns/chain_preview/chain_preview.tsx at fd99e0d
import { useId } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { chainNote, type ChainPreviewRow } from '../../helpers/steps'
import { taskEntry } from '../../helpers/strings'
import { padStep } from '../../helpers/words'
import { Frame } from '../../primitives/frame/frame'
import { OwnerChip } from '../owner_chip/owner_chip'
import { SectionHeader } from '../section_header/section_header'
import styles from './chain_preview.module.css'

export const CHAIN_PREVIEW_VARIANTS = ['framed', 'bare'] as const

/**
 * `framed`: in a frame, under a header with the chain note, for task entry.
 * `bare`: the rows alone, for the follow-up composer.
 */
export type ChainPreviewVariant = (typeof CHAIN_PREVIEW_VARIANTS)[number]

export interface ChainPreviewProps {
  variant: ChainPreviewVariant
  /** In chain order, numbered consecutively. The first number may be above 1. */
  steps: readonly ChainPreviewRow[]
  /** Placement only. */
  className?: string
}

/**
 * A chain's steps as a numbered list: the steps a new task will have before
 * it exists, or the steps a follow-up appends. An ordered list whose `start`
 * is the first step's number.
 */
export function ChainPreview({ variant, steps, className }: ChainPreviewProps) {
  const titleId = useId()

  if (variant === 'bare') {
    return <PreviewList steps={steps} className={joinClasses(styles.bare, className)} />
  }

  const yourSteps = steps.filter((step) => step.owner === 'you').length
  return (
    <Frame className={joinClasses(styles.framed, className)}>
      <SectionHeader
        level="label"
        rule={false}
        title={taskEntry.chainPreview}
        titleId={titleId}
        note={chainNote(steps.length, yourSteps)}
        noteAccent
      />
      <PreviewList steps={steps} labelledBy={titleId} className={styles.rows} />
    </Frame>
  )
}

interface PreviewListProps {
  steps: readonly ChainPreviewRow[]
  labelledBy?: string
  className: string
}

function PreviewList({ steps, labelledBy, className }: PreviewListProps) {
  return (
    <ol
      start={steps[0]?.number}
      aria-labelledby={labelledBy}
      className={joinClasses(styles.list, className)}
    >
      {steps.map((step) => (
        <li key={step.number} className={styles.row}>
          <span className={styles.number}>{padStep(step.number)}</span>
          <OwnerChip owner={step.owner} size="sm" form="named" sessionName={step.sessionName} />
          <span className={joinClasses('text-detail', styles.title)}>{step.title}</span>
        </li>
      ))}
    </ol>
  )
}
