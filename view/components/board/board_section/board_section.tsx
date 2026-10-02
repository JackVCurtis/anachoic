import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { FOLD_AFTER } from '../../helpers/constants'
import { joinClasses } from '../../helpers/join_classes'
import { fillTemplate, fold } from '../../helpers/strings'
import { Disclosure } from '../../patterns/disclosure/disclosure'
import { SectionHeader } from '../../patterns/section_header/section_header'
import { Frame } from '../../primitives/frame/frame'
import styles from './board_section.module.css'

/**
 * A card of the section, with the id of the task or session it shows.
 */
export interface SectionCard {
  id: string
  card: ReactNode
}

export interface BoardSectionProps {
  title: string
  count: number
  cards: readonly SectionCard[]
  /** Drawn in place of the list when it is empty. Nothing unless given. */
  empty?: ReactNode
  /** Draws the header on the inverse surface, as Your turn's is. */
  inverseHeader?: boolean
  /** A list longer than FOLD_AFTER shows only its first cards until opened. */
  folds?: boolean
  /** `ol` for a list whose order means something, as the queue's does. */
  listElement?: 'ul' | 'ol'
  /** `tight` puts the cards --space-2 apart, `loose` --space-4. */
  cardGap?: 'tight' | 'loose'
  /** Placement of the section only. */
  className?: string
  /** Drawn after the cards and their fold, whether or not there are cards. */
  footer?: ReactNode
  /** A press anywhere in the section, for a section whose cards are dragged. */
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void
}

/**
 * One section of the board: an h2 with a count, then its cards or its empty
 * state.
 */
export function BoardSection({
  title,
  count,
  cards,
  empty,
  inverseHeader = false,
  folds = true,
  listElement: List = 'ul',
  cardGap = 'tight',
  className,
  footer,
  onPointerDown,
}: BoardSectionProps) {
  const [open, setOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusedCard = useRef<HTMLLIElement | null>(null)

  function onFocus(event: FocusEvent<HTMLElement>) {
    focusedCard.current =
      event.target instanceof Element ? event.target.closest<HTMLLIElement>('li[data-card]') : null
  }

  /*
   * A focused element that is removed takes focus with it to the body. When
   * the card that held it left the list, focus goes to the heading instead,
   * without scrolling.
   */
  useLayoutEffect(() => {
    const card = focusedCard.current
    if (!card || card.isConnected) {
      return
    }
    focusedCard.current = null
    if (document.activeElement === null || document.activeElement === document.body) {
      headingRef.current?.focus({ preventScroll: true })
    }
  })

  const folded = folds && cards.length > FOLD_AFTER
  const shown = folded ? cards.slice(0, FOLD_AFTER) : cards
  const rest = folded ? cards.slice(FOLD_AFTER) : []

  const header = (
    <SectionHeader
      headingLevel={2}
      headingRef={headingRef}
      title={title}
      summary={count}
      spacing="roomy"
    />
  )

  return (
    <section
      className={joinClasses(styles.section, className)}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
    >
      {inverseHeader ? (
        <Frame tone="inverse" className={styles.inverseHeader}>
          {header}
        </Frame>
      ) : (
        header
      )}
      {cards.length === 0 ? (
        empty
      ) : (
        <List className={joinClasses(styles.list, cardGap === 'loose' && styles.loose)}>
          {shown.map(({ id, card }) => (
            <li key={id} data-card>
              {card}
            </li>
          ))}
        </List>
      )}
      {folded && (
        <Disclosure
          open={open}
          onToggle={() => setOpen(!open)}
          toggle={open ? fold.showFewer : fillTemplate(fold.showAll, { n: cards.length })}
          toggleVariant="utility"
          toggleSize="sm"
          toggleClassName={styles.toggle}
        >
          <List className={joinClasses(styles.list, cardGap === 'loose' && styles.loose)}>
            {rest.map(({ id, card }) => (
              <li key={id} data-card>
                {card}
              </li>
            ))}
          </List>
        </Disclosure>
      )}
      {footer}
    </section>
  )
}
