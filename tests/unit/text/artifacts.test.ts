import { describe, expect, test } from 'vitest'
import { emptyBoard } from '../../../server/props/empty_board.js'
import {
  boardSummary,
  estimateTokens,
  SUMMARY_TOKEN_BUDGET,
} from '../../../server/text/board_summary.js'
import { artifactLines } from '../../../server/text/model_tools.js'
import { boardPropsSchema, type Artifact, type BoardProps } from '../../../shared/props.js'
import { backlogTask } from '../support/domain.js'

const NOW = '2026-10-01T12:00:00.000Z'
const PR = 'https://github.com/acme/api/pull/12'

function ref(number: number, title = `Task ${number}`) {
  return { id: String(number), displayId: `T-${String(number).padStart(3, '0')}`, title }
}

describe('the board summary', () => {
  test('shows a task’s artifact links after it in every list that carries them', () => {
    const artifacts: Artifact[] = [
      { stepNumber: 2, format: 'pull_request', url: PR },
      { stepNumber: 4, format: 'document', url: 'https://docs.example.com/plan' },
    ]
    const board: BoardProps = {
      ...emptyBoard(new Date(NOW)),
      working: [
        {
          task: ref(1),
          step: { number: 3, title: 'Merge', runningSince: NOW },
          session: { id: 'a', name: 'api-server' },
          steps: [],
          artifacts,
        },
      ],
      queue: [
        {
          task: ref(2),
          position: 1,
          nextOwner: 'agent',
          steps: [],
          artifacts: [artifacts[0]],
          canAct: { reorder: true, backlog: true },
        },
      ],
      backlog: [
        { task: ref(3), steps: [], canAct: { queue: true, archive: true } },
        {
          task: ref(4),
          steps: [],
          artifacts: [artifacts[0]],
          canAct: { queue: true, archive: true },
        },
      ],
      toSignOff: [
        {
          task: ref(5),
          finishedAt: NOW,
          agentSeconds: 0,
          yourSeconds: 0,
          linkCount: 0,
          steps: [],
          artifacts: [{ stepNumber: 1, format: 'link', url: 'http://example.com' }],
          canAct: { signOff: true, followUp: true, archive: true },
        },
      ],
    }
    const lines = boardSummary(boardPropsSchema.parse(board)).split('\n')
    expect(lines[2]).toBe(
      `Working (1): T-001 step 3 "Merge" (api-server, 0m) (step 2: Pull request ${PR}, step 4: Document https://docs.example.com/plan)`
    )
    expect(lines[3]).toBe(`Queue (1): 1. T-002 "Task 2" next: agent (step 2: Pull request ${PR})`)
    expect(lines[4]).toBe(`Backlog (2): T-003, T-004 (step 2: Pull request ${PR})`)
    expect(lines[5]).toBe('To sign off (1): T-005 "Task 5" (step 1: Link http://example.com)')
  })

  test('stays under its token budget when every task has many artifacts with the longest URLs', () => {
    const longUrl = `https://example.com/${'a'.repeat(1980)}`
    const artifacts: Artifact[] = Array.from({ length: 20 }, (_, index) => ({
      stepNumber: index + 1,
      format: 'pull_request',
      url: longUrl,
    }))
    const long = 'x'.repeat(200)
    const board: BoardProps = {
      ...emptyBoard(new Date(NOW)),
      working: Array.from({ length: 25 }, (_, index) => ({
        task: ref(index + 1, long),
        step: { number: 21, title: long, runningSince: NOW },
        session: { id: 'a', name: 'n'.repeat(40) },
        steps: [],
        artifacts,
      })),
      queue: Array.from({ length: 25 }, (_, index) => ({
        task: ref(index + 26, long),
        position: index + 1,
        nextOwner: 'agent' as const,
        steps: [],
        artifacts,
        canAct: { reorder: true, backlog: true },
      })),
      backlog: Array.from({ length: 25 }, (_, index) => ({
        task: ref(index + 51, long),
        steps: [],
        artifacts,
        canAct: { queue: true, archive: true },
      })),
      toSignOff: Array.from({ length: 25 }, (_, index) => ({
        task: ref(index + 76, long),
        finishedAt: NOW,
        agentSeconds: 0,
        yourSeconds: 0,
        linkCount: 0,
        steps: [],
        artifacts,
        canAct: { signOff: true, followUp: true, archive: true },
      })),
    }
    const summary = boardSummary(boardPropsSchema.parse(board))
    expect(estimateTokens(summary)).toBeLessThan(SUMMARY_TOKEN_BUDGET)
    expect(summary).toContain(', and 17 more)')
  })
})

describe('artifactLines', () => {
  test('lists each earlier step with an artifact, as the worker’s texts name it', () => {
    const { steps } = backlogTask(['agent', 'you', 'you', 'agent'])
    steps[1] = { ...steps[1], status: 'done', outputFormat: 'pull_request', artifactUrl: PR }
    steps[2] = { ...steps[2], status: 'done', outputFormat: 'ticket', artifactUrl: 'https://t/1' }
    expect(artifactLines(steps, 4)).toEqual([
      `Step 2 (you): Pull request ${PR}`,
      'Step 3 (you): Ticket https://t/1',
    ])
    expect(artifactLines(steps, 3)).toEqual([`Step 2 (you): Pull request ${PR}`])
  })
})
