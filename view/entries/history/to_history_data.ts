import type { HistoryProps } from '../../../shared/props'
import type { HistoryPage } from '../../components/board/board_data'

/**
 * The server's history props in the History view's own terms.
 */
export function toHistoryPage(props: HistoryProps): HistoryPage {
  return {
    rows: props.rows.map(({ finishedAt: _finishedAt, ...row }) => row),
    page: props.page,
    pageCount: props.pageCount,
    total: props.total,
    filter: props.filter,
  }
}
