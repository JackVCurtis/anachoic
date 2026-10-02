// Adapted from anachoic inertia/components/completed/completed_view/completed_view.tsx at fd99e0d
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { FILTER_DELAY_MS, historySummary } from '../../helpers/history'
import { joinClasses } from '../../helpers/join_classes'
import { busy as busyLabels, history } from '../../helpers/strings'
import { BusyIndicator } from '../../patterns/busy_indicator/busy_indicator'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { FlashMessageData } from '../../patterns/flash_message/flash_message'
import { FlashMessages } from '../../patterns/flash_message/flash_messages'
import { PageHeader } from '../../patterns/page_header/page_header'
import { Button } from '../../primitives/button/button'
import { TextInput } from '../../primitives/text_input/text_input'
import type { HistoryPage, SafeAreaInsets } from '../board_data'
import { CompletedTable } from '../completed_table/completed_table'
import { Pagination } from '../pagination/pagination'
import styles from './history_view.module.css'

export interface HistoryViewProps {
  /** The page shown. Null until the first one arrives. */
  history: HistoryPage | null
  /** The filter the field starts with. */
  filter?: string
  /** Another page, or the rows for a new filter, is being fetched. */
  busy?: boolean
  onPageChange: (page: number) => void
  /** Called once typing in the filter field has stopped for FILTER_DELAY_MS. */
  onFilterChange: (filter: string) => void
  onOpenTask: (taskId: string) => void
  /** Asks the host to open an artifact link. */
  onOpenLink: (url: string) => void
  /** "Back to board" was pressed. Without it the view offers no way back. */
  onBackToBoard?: () => void
  /** What went wrong with the user's last actions here: none, or one of each kind. */
  messages?: readonly FlashMessageData[]
  onDismissMessage?: (id: string) => void
  /** The host's safe-area insets, in pixels. */
  safeAreaInsets?: SafeAreaInsets | null
  /** Sends focus to the title when the view first shows, as when the board swaps it in. */
  focusOnShow?: boolean
}

function ignore() {}

/**
 * The host's safe-area insets, which the padding gives way to when they are
 * larger than it.
 */
function insetStyle(insets: SafeAreaInsets | null | undefined): CSSProperties | undefined {
  if (!insets) {
    return undefined
  }
  return {
    '--history-inset-top': `${insets.top}px`,
    '--history-inset-right': `${insets.right}px`,
    '--history-inset-bottom': `${insets.bottom}px`,
    '--history-inset-left': `${insets.left}px`,
  } as CSSProperties
}

/**
 * The completed tasks, a page at a time, as tall as its content: the header
 * with the count, the filter field, the table and Pagination. A page asked
 * for with Pagination arrives with focus on the title; a page that arrives
 * for a new filter leaves focus in the field.
 */
export function HistoryView({
  history: shown,
  filter = '',
  busy = false,
  onPageChange,
  onFilterChange,
  onOpenTask,
  onOpenLink,
  onBackToBoard,
  messages = [],
  onDismissMessage = ignore,
  safeAreaInsets,
  focusOnShow = false,
}: HistoryViewProps) {
  const fieldId = useId()
  const title = useRef<HTMLHeadingElement>(null)
  const [draft, setDraft] = useState(filter)
  const sent = useRef(filter)
  const filterChanged = useRef(onFilterChange)
  const paging = useRef(false)
  const page = shown?.page ?? null

  useLayoutEffect(() => {
    filterChanged.current = onFilterChange
  })

  useEffect(() => {
    if (draft === sent.current) {
      return
    }
    const timer = setTimeout(() => {
      sent.current = draft
      filterChanged.current(draft)
    }, FILTER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft])

  const focusedOnShow = useRef(false)
  useLayoutEffect(() => {
    if (focusOnShow && !focusedOnShow.current) {
      focusedOnShow.current = true
      title.current?.focus()
    }
  }, [focusOnShow])

  useLayoutEffect(() => {
    if (!paging.current) {
      return
    }
    paging.current = false
    title.current?.focus()
  }, [page])

  function changePage(next: number) {
    paging.current = true
    onPageChange(next)
  }

  return (
    <div className={styles.view} style={insetStyle(safeAreaInsets)}>
      <div className={styles.top}>
        <PageHeader
          title={history.title}
          summary={shown ? historySummary(shown.total) : ''}
          titleRef={title}
          className={styles.header}
        />
        {onBackToBoard && (
          <Button variant="secondary" size="sm" onPress={onBackToBoard}>
            {history.backToBoard}
          </Button>
        )}
      </div>
      {messages.length > 0 && (
        <FlashMessages messages={messages} onDismiss={onDismissMessage} focusTarget={title} />
      )}
      <div className={styles.filter}>
        <label
          id={`${fieldId}-label`}
          htmlFor={fieldId}
          className={joinClasses('text-label', styles.label)}
        >
          {history.filterLabel}
        </label>
        <TextInput
          id={fieldId}
          labelledBy={`${fieldId}-label`}
          value={draft}
          onChange={setDraft}
          placeholder={history.filterPlaceholder}
          className={styles.field}
        />
      </div>
      {shown === null ? (
        <BusyIndicator label={busyLabels.loadingHistory} />
      ) : shown.rows.length === 0 ? (
        <EmptyState
          variant="framed"
          message={shown.filter === '' ? history.emptyYet : history.emptyMatch}
        />
      ) : (
        <CompletedTable tasks={shown.rows} onOpenTask={onOpenTask} onOpenLink={onOpenLink} />
      )}
      {shown && (
        <Pagination
          page={shown.page}
          pageCount={shown.pageCount}
          busy={busy}
          onPageChange={changePage}
        />
      )}
    </div>
  )
}
