import type { CallToolResult } from '@modelcontextprotocol/client'
import type { GetHistoryResult, HistoryProps } from '../../../shared/props'

const AT = '2026-03-12T09:41:00.000Z'

/**
 * One page of the history at the given revision, with T-012 on it.
 */
export function historyProps(revision = 1, page = 1, filter = ''): HistoryProps {
  return {
    revision,
    now: AT,
    page,
    pageCount: Math.max(page, 1),
    total: 1,
    filter,
    rows: [
      {
        task: { id: '12', displayId: 'T-012', title: 'Add caching', assignedTo: null },
        signedOffAt: AT,
        finishedAt: AT,
        steps: [
          {
            id: 's1',
            owner: 'agent',
            status: 'done',
            title: 'Open the PR',
            sessionName: null,
            outputFormat: 'pull_request',
            artifactUrl: 'https://github.com/acme/app/pull/7',
          },
        ],
        agentSeconds: 600,
        userSeconds: 0,
        workers: ['api-server'],
        artifacts: [
          { stepNumber: 1, format: 'pull_request', url: 'https://github.com/acme/app/pull/7' },
        ],
      },
    ],
  }
}

/**
 * A tool result carrying the given history result, as get_history and show_history send it.
 */
export function historyResult(result: GetHistoryResult): CallToolResult {
  return {
    content: [{ type: 'text', text: `History, revision ${result.revision}` }],
    structuredContent: result,
  }
}
