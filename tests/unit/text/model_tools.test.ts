import { describe, expect, test } from 'vitest'
import {
  addToQueue,
  ask,
  block,
  claim,
  completeStep,
  followUp,
  note,
  queue,
  release,
  unblock,
} from '../../../domain/transitions.js'
import type { Change } from '../../../domain/transitions.js'
import type { TaskState } from '../../../domain/types.js'
import {
  addFollowUpText,
  addTaskText,
  askYouText,
  blockHistory,
  blockStepText,
  claimStepText,
  completeStepText,
  queueTaskText,
  unblockStepText,
  updateStepText,
} from '../../../server/text/model_tools.js'
import { accepted, backlogTask, ctx, stateOf, textForm } from '../support/domain.js'

const A = 'session-a'

/**
 * The task as the store returns it, with the queue position the store gave it.
 */
function at(change: Change | TaskState, queuePosition: number | null = null): TaskState {
  return { task: { ...change.task, queuePosition }, steps: change.steps }
}

function newTask(owners: Array<'agent' | 'you'>) {
  return addToQueue(
    {
      taskId: 12,
      title: 'Add caching',
      steps: owners.map((owner, index) => ({
        title: ['Draft the plan', 'Choose the cache key', 'Review the PR'][index],
        owner,
        detail: index === 1 ? 'Redis or in-process' : null,
      })),
    },
    ctx(A)
  )
}

describe('add_task, queue_task and add_follow_up', () => {
  test('say where the task went', () => {
    expect(addTaskText(at(newTask(['agent']), 4))).toBe('Added T-012 to the queue at position 4')
    expect(addTaskText(backlogTask(['agent']))).toBe('Added T-012 to the backlog')
    expect(addTaskText(at(newTask(['you'])))).toBe(
      'Added T-012. T-012 is active: step 1 "Draft the plan" waits on the user'
    )

    expect(queueTaskText(at(stateOf(queue(backlogTask(['agent']), ctx(A))), 4))).toBe(
      'T-012 is in the queue at position 4'
    )
    expect(queueTaskText(stateOf(queue(backlogTask(['you']), ctx(A))))).toBe(
      'T-012 is active: step 1 "Step 1" waits on the user'
    )
  })

  test('add_follow_up counts the new steps', () => {
    const done = stateOf(
      completeStep(stateOf(claim(at(newTask(['agent']), 1), ctx(A))), ctx(A), { summary: 'Done' })
    )
    const agentFirst = followUp(done, ctx(A), {
      steps: [
        { title: 'Fix', owner: 'agent' },
        { title: 'Check', owner: 'you' },
      ],
      placement: 'first',
    })
    expect(addFollowUpText(at(accepted(agentFirst), 1), 2)).toBe(
      'T-012 is back in the queue at position 1 with 2 new steps'
    )
    const yoursFirst = followUp(done, ctx(A), {
      steps: [{ title: 'Check', owner: 'you' }],
      placement: 'last',
    })
    expect(addFollowUpText(stateOf(yoursFirst), 1)).toBe(
      'T-012 is active: step 2 "Check" waits on the user, with 1 new step'
    )
  })
})

describe('the worker tools', () => {
  const claimed = stateOf(claim(at(newTask(['agent', 'agent', 'you']), 1), ctx(A)))
  const second = stateOf(
    claim(
      at(stateOf(completeStep(claimed, ctx(A), { summary: 'Plan in the PR description' })), 1),
      ctx(A)
    )
  )

  test('claim_step gives the step, the chain so far with summaries, and what to call next', () => {
    expect(claimStepText(second)).toBe(
      [
        'Claimed T-012 step 2 of 3: "Choose the cache key"',
        'Task: "Add caching"',
        'Detail: Redis or in-process',
        'Done so far:',
        '1. "Draft the plan" (agent): Plan in the PR description',
        'After this step:',
        '3. "Review the PR" (user)',
        'Next: do the step. Call update_step with task T-012 to note progress, ask_you if you need an answer from the user, and complete_step with task T-012, a summary and links when it is done.',
      ].join('\n')
    )
  })

  test('claim_step names its input first and what the step produces', () => {
    const url = 'https://github.com/acme/api/pull/12'
    const formatted = addToQueue(
      {
        taskId: 12,
        title: 'Add caching',
        steps: [
          { title: 'Open the PR', owner: 'agent', outputFormat: 'pull_request' },
          { title: 'Write the docs', owner: 'agent', outputFormat: 'document' },
        ],
      },
      ctx(A)
    )
    const first = stateOf(claim(at(formatted, 1), ctx(A)))
    expect(claimStepText(first).split('\n')).toContain(
      'Produces: a pull request. Finish with complete_step and artifact_url.'
    )
    expect(claimStepText(first)).not.toContain('Input from')
    const done = accepted(completeStep(first, ctx(A), { summary: 'Opened', artifactUrl: url }))
    const next = stateOf(claim(at(done, 1), ctx(A)))
    expect(claimStepText(next)).toBe(
      [
        'Claimed T-012 step 2 of 2: "Write the docs"',
        `Input from step 1: Pull request ${url}`,
        'Task: "Add caching"',
        'Produces: a document. Finish with complete_step and artifact_url.',
        'Done so far:',
        '1. "Open the PR" (agent): Opened',
        'Artifacts:',
        `Step 1 (agent): Pull request ${url}`,
        'Next: do the step. Call update_step with task T-012 to note progress, ask_you if you need an answer from the user, and complete_step with task T-012, a summary and links when it is done.',
      ].join('\n')
    )
  })

  test('update_step and ask_you', () => {
    expect(updateStepText(stateOf(note(second, ctx(A), { note: 'Halfway' })))).toBe(
      'Noted on T-012 step 2'
    )
    const asked = stateOf(ask(second, ctx(A), textForm('Redis?')))
    expect(askYouText(asked)).toBe('Asked. Call wait_for_answer with task T-012 next.')
  })

  test('complete_step says the task is back in the queue, waits on the user, or is done', () => {
    const requeued = accepted(completeStep(claimed, ctx(A), { summary: 'Planned' }))
    expect(completeStepText(at(requeued, 1), requeued.events)).toBe(
      'Completed T-012 step 1. T-012 is back in the queue at position 1. Call claim_step with task T-012 to continue it.'
    )

    const yours = accepted(completeStep(second, ctx(A), { summary: 'Redis' }))
    expect(completeStepText(at(yours), yours.events)).toBe(
      "Completed T-012 step 2. Step 3 of T-012 is the user's. Call wait_for_work to be told when this task needs an agent again."
    )
    expect(completeStepText(at(yours), yours.events, 'dedicated')).toBe(
      'Completed T-012 step 2. Step 3 "Review the PR" waits on the user.'
    )

    const only = stateOf(claim(at(newTask(['agent']), 1), ctx(A)))
    const done = accepted(completeStep(only, ctx(A), { summary: 'Done' }))
    expect(completeStepText(at(done), done.events)).toBe('Completed T-012 step 1. T-012 is done.')
  })
})

describe('blocked steps', () => {
  const claimed = () => stateOf(claim(stateOf(newTask(['agent', 'agent'])), ctx(A, 0)))

  test('block_step and unblock_step say what to do next', () => {
    const blocked = stateOf(block(claimed(), ctx(A, 60), 'needs AWS credentials'))
    expect(blockStepText(blocked)).toBe(
      'Blocked. The user will unblock this in this session. End this turn now and wait for the user here; when they have resolved it, call unblock_step with task T-012.'
    )
    expect(unblockStepText(stateOf(unblock(blocked, ctx(A, 120))))).toBe(
      'Unblocked. Carry on with step 1 of T-012.'
    )
  })

  test('claim_step names a past block of the claimed step and of the steps before it', () => {
    const blocked = accepted(block(claimed(), ctx(A, 60), 'needs AWS credentials'))
    const unblocked = accepted(unblock(stateOf(blocked), ctx(A, 60 + 14 * 60), 'Done'))
    const reblocked = accepted(block(stateOf(unblocked), ctx(A, 1000), 'needs a VPN'))
    const released = accepted(release(stateOf(reblocked), ctx(A, 1000 + 5 * 60)))
    const events = [...blocked.events, ...unblocked.events, ...reblocked.events, ...released.events]
    const history = blockHistory(events, ctx(A, 5000).now)
    expect([...history.values()]).toEqual([
      ['blocked 14m: needs AWS credentials', 'blocked 5m: needs a VPN'],
    ])

    const again = stateOf(claim(stateOf(released), ctx('session-b', 1400)))
    expect(claimStepText(again, 'session-b', history)).toContain(
      'Before this claim, the step was blocked 14m: needs AWS credentials; blocked 5m: needs a VPN'
    )
    const completed = stateOf(completeStep(again, ctx('session-b', 1500), { summary: 'Deployed' }))
    const next = stateOf(claim(at(completed, 1), ctx('session-b', 1600)))
    expect(claimStepText(next, 'session-b', history)).toContain(
      '1. "Draft the plan" (agent): Deployed (blocked 14m: needs AWS credentials; blocked 5m: needs a VPN)'
    )
  })
})
