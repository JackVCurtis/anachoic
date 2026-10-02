import type { CallToolResult } from '@modelcontextprotocol/client'
import type { GetTaskResult, TaskProps } from '../../../shared/props'

const AT = '2026-03-12T09:41:00.000Z'

/**
 * T-012 with one agent step waiting in the queue, at the given revision.
 */
export function taskProps(revision = 1): TaskProps {
  return {
    revision,
    now: AT,
    task: {
      id: '12',
      displayId: 'T-012',
      title: 'Add caching',
      assignedTo: null,
      status: 'queue',
      list: 'queue',
      queuePosition: 1,
      createdBy: 'you',
      createdAt: AT,
      finishedAt: null,
      signedOffAt: null,
      archivedAt: null,
      resumeWith: null,
    },
    steps: [
      {
        id: 's1',
        number: 1,
        owner: 'agent',
        title: 'Open the PR',
        detail: null,
        status: 'pending',
        origin: 'chain',
        current: true,
        session: null,
        question: null,
        answer: null,
        note: null,
        summary: null,
        links: [],
        outputFormat: 'pull_request',
        artifactUrl: null,
        input: null,
        blocked: null,
        startedAt: null,
        runningSince: null,
        waitingSince: null,
        finishedAt: null,
        elapsedSeconds: 0,
        waitedSeconds: 0,
      },
    ],
    agentSeconds: 0,
    yourSeconds: 0,
    artifacts: [],
    events: [
      { id: 1, at: AT, kind: 'added', stepNumber: null, by: 'you', detail: 'Added with 1 step' },
    ],
    canAct: { archive: true, park: false },
  }
}

/**
 * A tool result carrying the given task result, as get_task and open_task send it.
 */
export function taskResult(result: GetTaskResult): CallToolResult {
  return {
    content: [{ type: 'text', text: `T-012, revision ${result.revision}` }],
    structuredContent: result,
  }
}

/**
 * A refused tool call, with its sentence.
 */
export function refusedResult(sentence: string): CallToolResult {
  return { content: [{ type: 'text', text: sentence }], isError: true }
}
