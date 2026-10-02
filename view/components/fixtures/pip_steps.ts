// Copied from anachoic inertia/components/fixtures/pip_steps.ts at fd99e0d
import type { Owner, StepStatus } from '../types.js'

/**
 * A step with only the fields a row of pips reads.
 */
export type PipStepSample = {
  id: string
  owner: Owner
  status: StepStatus
  title: string
  sessionName: string | null
}

/**
 * One step of each look, in chain order: done, running, waiting on you,
 * not started. No real chain has a running and a waiting step at once.
 */
export const EACH_APPEARANCE: readonly PipStepSample[] = [
  {
    id: 'pips-done',
    owner: 'agent',
    status: 'done',
    title: 'Draft the migration',
    sessionName: 'api-server',
  },
  {
    id: 'pips-running',
    owner: 'agent',
    status: 'running',
    title: 'Backfill the new column',
    sessionName: 'web-client',
  },
  {
    id: 'pips-waiting',
    owner: 'you',
    status: 'waiting',
    title: 'Review the migration',
    sessionName: null,
  },
  {
    id: 'pips-pending',
    owner: 'agent',
    status: 'pending',
    title: 'Open the PR',
    sessionName: null,
  },
]

/**
 * Queued partway through its chain: two steps done, two not started, and no
 * session holds any of them.
 */
export const QUEUED_CHAIN: readonly PipStepSample[] = [
  {
    id: 'pips-queued-1',
    owner: 'agent',
    status: 'done',
    title: 'Find every caller of the old cache',
    sessionName: 'api-server',
  },
  {
    id: 'pips-queued-2',
    owner: 'you',
    status: 'done',
    title: 'Choose the cache key',
    sessionName: null,
  },
  {
    id: 'pips-queued-3',
    owner: 'agent',
    status: 'pending',
    title: 'Move the readers to the new cache',
    sessionName: null,
  },
  {
    id: 'pips-queued-4',
    owner: 'you',
    status: 'pending',
    title: 'Review the PR and merge',
    sessionName: null,
  },
]

/**
 * An agent step that asked you a question and waits for the answer. The
 * session that asked still holds it.
 */
export const AGENT_ASKS: readonly PipStepSample[] = [
  {
    id: 'pips-asks-1',
    owner: 'agent',
    status: 'done',
    title: 'Profile the slow endpoint',
    sessionName: 'api-server',
  },
  {
    id: 'pips-asks-2',
    owner: 'agent',
    status: 'waiting',
    title: 'Add a cache in front of the query',
    sessionName: 'api-server',
  },
  {
    id: 'pips-asks-3',
    owner: 'you',
    status: 'pending',
    title: 'Check the numbers on staging',
    sessionName: null,
  },
]

/**
 * A chain waiting on your step after an agent finished its own.
 */
export const YOUR_STEP_WAITING: readonly PipStepSample[] = [
  {
    id: 'pips-yours-1',
    owner: 'agent',
    status: 'done',
    title: 'Fix the flaky login test',
    sessionName: 'web-client',
  },
  {
    id: 'pips-yours-2',
    owner: 'you',
    status: 'waiting',
    title: 'Review the PR',
    sessionName: null,
  },
  {
    id: 'pips-yours-3',
    owner: 'agent',
    status: 'pending',
    title: 'Merge and watch the build',
    sessionName: null,
  },
]

/**
 * A step running in this chat, the dedicated session.
 */
export const HELD_BY_THIS_CHAT: readonly PipStepSample[] = [
  {
    id: 'pips-chat-1',
    owner: 'agent',
    status: 'running',
    title: 'Write the release notes',
    sessionName: 'This chat',
  },
  {
    id: 'pips-chat-2',
    owner: 'you',
    status: 'pending',
    title: 'Read the release notes',
    sessionName: null,
  },
]

/**
 * A chain of one step that no session holds yet.
 */
export const ONE_STEP: readonly PipStepSample[] = [
  {
    id: 'pips-one',
    owner: 'agent',
    status: 'pending',
    title: 'Bump the SDK to the latest minor',
    sessionName: null,
  },
]

const TWELVE_TITLES: readonly [Owner, string][] = [
  ['agent', 'Map every caller of the legacy billing client'],
  ['you', 'Choose the order of the move'],
  ['agent', 'Move the invoice reads'],
  ['agent', 'Move the invoice writes'],
  ['agent', 'Move the refund path'],
  ['you', 'Check the refunds on staging'],
  ['agent', 'Move the dunning emails'],
  ['agent', 'Delete the legacy client'],
  ['agent', 'Update the runbook'],
  ['you', 'Review the PR and merge'],
  ['agent', 'Watch the error rate for a day'],
  ['you', 'Sign off on the migration'],
]

/**
 * A chain of twelve steps with five done and the sixth, yours, waiting.
 */
export const TWELVE_STEPS: readonly PipStepSample[] = TWELVE_TITLES.map(
  ([owner, title], index): PipStepSample => {
    const status: StepStatus = index < 5 ? 'done' : index === 5 ? 'waiting' : 'pending'
    return {
      id: `pips-twelve-${index + 1}`,
      owner,
      status,
      title,
      sessionName: owner === 'agent' && status === 'done' ? 'api-server' : null,
    }
  }
)
