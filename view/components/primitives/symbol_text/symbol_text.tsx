import { Fragment } from 'react'
import { assistive } from '../../helpers/strings'
import { VisuallyHidden } from '../visually_hidden/visually_hidden'

/**
 * The characters that are not words (anachoic ui/16). The capturing group
 * keeps each one in the result of `split`, at an odd index.
 */
const NOT_WORDS = /([↗→←·—×⇧])/u

/** The dash that stands for an empty value, which is read as "none". */
const EMPTY_VALUE = '—'

/**
 * Text drawn as it is, with each character that is not a word hidden from
 * assistive technology. The spaces around a character stay readable, so
 * "Step 2 · Draft" is read as "Step 2 Draft". The dash of an empty value is
 * read as "none".
 */
export function SymbolText({ children }: { children: string }) {
  return children.split(NOT_WORDS).map((part, index) =>
    index % 2 === 1 ? (
      <Fragment key={index}>
        <span aria-hidden="true">{part}</span>
        {part === EMPTY_VALUE && <VisuallyHidden>{assistive.none}</VisuallyHidden>}
      </Fragment>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  )
}
