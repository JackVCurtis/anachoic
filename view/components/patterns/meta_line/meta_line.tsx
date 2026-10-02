// Copied from anachoic inertia/components/patterns/meta_line/meta_line.tsx at fd99e0d
import { Fragment } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'
import styles from './meta_line.module.css'

export const META_LINE_TONES = ['meta', 'detail'] as const

export type MetaLineTone = (typeof META_LINE_TONES)[number]

/**
 * A middle dot, U+00B7, with a space each side.
 */
const SEPARATOR = ' · '

const TONE_TYPE: Record<MetaLineTone, string> = {
  meta: 'text-hint',
  detail: 'text-detail',
}

export interface MetaLineProps {
  /** `meta`: 11px in the meta color. `detail`: 12px in the muted color. */
  tone: MetaLineTone
  /** The facts, in reading order. Empty strings are left out. */
  facts: readonly string[]
  /** Placement only. */
  className?: string
}

/**
 * A row of short facts separated by middle dots. The dots are hidden from
 * assistive technology, so only the facts are read.
 */
export function MetaLine({ tone, facts, className }: MetaLineProps) {
  const shown = facts.filter((fact) => fact !== '')

  return (
    <span className={joinClasses(TONE_TYPE[tone], styles.line, styles[tone], className)}>
      {shown.map((fact, index) => (
        // Facts may repeat, so their place in the line is their identity.
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">{SEPARATOR}</span>}
          <span>
            <SymbolText>{fact}</SymbolText>
          </span>
        </Fragment>
      ))}
    </span>
  )
}
