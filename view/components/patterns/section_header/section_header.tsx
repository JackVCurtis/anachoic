// Copied from anachoic inertia/components/patterns/section_header/section_header.tsx at fd99e0d
import type { ReactNode, Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { Rule } from '../../primitives/rule/rule'
import styles from './section_header.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type SectionHeaderSize = 'md' | 'sm'

export type SectionHeaderSpacing = 'compact' | 'roomy'

/**
 * `count` is `text-count`, for a number or a short summary after the title.
 * `detail` is body text at 12px, for the chat header's note.
 */
export type SectionHeaderSummaryType = 'count' | 'detail'

/**
 * `note` is `text-note`, used in the rail and the chain preview. `status` is
 * `text-status`, used in the drawer.
 */
export type SectionHeaderNoteType = 'note' | 'status'

interface SharedProps {
  title: string
  /** A count or a summary, shown after the title. */
  summary?: string | number
  summaryType?: SectionHeaderSummaryType
  /** The hairline from the title to the end of the row. On unless turned off. */
  rule?: boolean
  spacing?: SectionHeaderSpacing
  /** A note at the end of the row. */
  note?: string
  noteType?: SectionHeaderNoteType
  /** Draws the note in --color-text-accent, as the chain note is. */
  noteAccent?: boolean
  /** A small button or a small segmented control at the end of the row. */
  trailing?: ReactNode
  /** Placement only. The space above and below the header belongs to the parent. */
  className?: string
}

export interface SectionLevelProps extends SharedProps {
  level?: 'section'
  /** The parent chooses the heading level from the screen's outline. */
  headingLevel: HeadingLevel
  size?: SectionHeaderSize
  /** The heading, for a script that sends focus to it. */
  headingRef?: Ref<HTMLHeadingElement>
  headingId?: string
}

export interface LabelLevelProps extends SharedProps {
  level: 'label'
  /** Title in --color-accent-800 and rule in --color-accent-300. */
  accent?: boolean
  /** `legend` makes the whole header the legend of the fieldset it opens. */
  element?: 'div' | 'legend'
  titleId?: string
}

export type SectionHeaderProps = SectionLevelProps | LabelLevelProps

/**
 * Names a block of content. At section level the title is a heading that a
 * script may focus; at label level it is plain text or a legend.
 */
export function SectionHeader(props: SectionHeaderProps) {
  if (props.level === 'label') {
    const { title, accent = false, element = 'div', titleId } = props
    return (
      <HeaderRow {...props} element={element} accent={accent}>
        <span id={titleId} className={joinClasses('text-label', accent && styles.accent)}>
          {title}
        </span>
      </HeaderRow>
    )
  }

  const { title, headingLevel, size = 'md', headingRef, headingId, ...row } = props
  const Heading = `h${headingLevel}` as const
  return (
    <HeaderRow {...row} element="div" accent={false}>
      <Heading
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className={joinClasses('text-section', size === 'sm' && styles.small)}
      >
        {title}
      </Heading>
    </HeaderRow>
  )
}

interface HeaderRowProps extends Omit<SharedProps, 'title'> {
  element: 'div' | 'legend'
  accent: boolean
  /** The title element. */
  children: ReactNode
}

function HeaderRow({
  element: Root,
  accent,
  children,
  summary,
  summaryType = 'count',
  rule = true,
  spacing = 'compact',
  note,
  noteType = 'note',
  noteAccent = false,
  trailing,
  className,
}: HeaderRowProps) {
  const hasEnd = note !== undefined || trailing !== undefined

  return (
    <Root
      className={joinClasses(
        styles.header,
        rule ? styles.centered : styles.baseline,
        spacing === 'roomy' && styles.roomy,
        Root === 'legend' && styles.legend,
        className
      )}
    >
      {children}
      {summary !== undefined && (
        <span
          className={joinClasses(
            summaryType === 'detail' ? 'text-detail' : 'text-count',
            styles.subtle
          )}
        >
          {summary}
        </span>
      )}
      {rule && <Rule accent={accent} />}
      {hasEnd && (
        <span className={styles.end}>
          {note !== undefined && (
            <span
              className={joinClasses(
                noteType === 'status' ? 'text-status' : 'text-note',
                noteAccent ? styles.noteAccent : styles.subtle
              )}
            >
              <SymbolText>{note}</SymbolText>
            </span>
          )}
          {trailing}
        </span>
      )}
    </Root>
  )
}
