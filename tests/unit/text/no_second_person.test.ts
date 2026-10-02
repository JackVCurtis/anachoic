import { describe, expect, test } from 'vitest'
import { isRefusal } from '../../../domain/refusal.js'
import {
  addToQueue,
  answer,
  archive,
  ask,
  block,
  claim,
  completeMyStep,
  completeStep,
  followUp,
  moveToBacklog,
  note,
  park,
  queue,
  release,
  reorder,
  signOff,
  start,
  unblock,
  unqueue,
  type Outcome,
} from '../../../domain/transitions.js'
import type { Actor, Owner, TaskState } from '../../../domain/types.js'
import { INSTRUCTIONS, TOOL_DESCRIPTIONS } from '../../../server/instructions.js'
import { emptyBoard } from '../../../server/props/empty_board.js'
import { boardSummary } from '../../../server/text/board_summary.js'
import { joinBoardText } from '../../../server/text/join_board.js'
import {
  addFollowUpText,
  addTaskText,
  askYouText,
  blockStepText,
  claimStepText,
  completeStepText,
  queueTaskText,
  unblockStepText,
  updateStepText,
} from '../../../server/text/model_tools.js'
import { viewActionText } from '../../../server/text/view_actions.js'
import { LEFT_THE_BOARD } from '../../../server/tools/leave_board.js'
import { DEDICATED_ASK } from '../../../server/tools/model.js'
import { answeredText, NO_ANSWER_YET } from '../../../server/tools/wait_for_answer.js'
import { NO_WORK_YET, workText } from '../../../server/tools/wait_for_work.js'
import { accepted, ctx, stateOf } from '../support/domain.js'

/**
 * "You" in a text Claude reads is always Claude. These phrases are the only
 * places it appears, each addressed to the model; the user is "the user".
 */
const ALLOWED = [
  'You are the dedicated session',
  'You are a worker session',
  'is assigned to you',
  'answered your question',
  'if you need an answer',
  'Your claims went back',
  'Your claim on',
  'not claimed by you',
  '"you" is accepted for "user"',
]

function secondPerson(text: string): string[] {
  let rest = text
  for (const phrase of ALLOWED) rest = rest.split(phrase).join('')
  return [
    ...(rest.match(/\b(you|your|yours)\b/gi) ?? []),
    ...(rest.match(/the person/gi) ?? []),
    ...(rest.match(/your turn/gi) ?? []),
  ]
}

const A = 'session-a'
const ACTORS: Actor[] = ['you', A, 'session-b']

function chain(owners: Owner[]): TaskState {
  const { task, steps } = addToQueue(
    {
      taskId: 12,
      title: 'Add caching',
      steps: owners.map((owner, index) => ({
        title: `Step ${index + 1}`,
        owner,
        outputFormat: owner === 'agent' ? 'pull_request' : null,
      })),
    },
    ctx()
  )
  return { task, steps }
}

const OPERATIONS: Array<(state: TaskState, actor: Actor) => Outcome> = [
  (s, a) => queue(s, ctx(a)),
  (s, a) => unqueue(s, ctx(a)),
  (s, a) => reorder(s, ctx(a), 1),
  (s, a) => claim(s, ctx(a)),
  (s, a) => start(s, ctx(a)),
  (s, a) => note(s, ctx(a), { note: 'Progress' }),
  (s, a) => ask(s, ctx(a), 'Which?'),
  (s, a) => answer(s, ctx(a), 'That one'),
  (s, a) => block(s, ctx(a), 'Needs credentials'),
  (s, a) => unblock(s, ctx(a)),
  (s, a) => completeStep(s, ctx(a), { summary: 'Done' }),
  (s, a) => completeStep(s, ctx(a), { summary: 'Done', artifactUrl: 'ftp://x' }),
  (s, a) => completeStep(s, ctx(a), { summary: 'Done', artifactUrl: 'https://e.com/pr/1' }),
  (s, a) => completeMyStep(s, ctx(a)),
  (s, a) => park(s, ctx(a)),
  (s, a) => moveToBacklog(s, ctx(a)),
  (s, a) => release(s, ctx(a)),
  (s, a) => signOff(s, ctx(a)),
  (s, a) =>
    followUp(s, ctx(a), {
      placement: 'last',
      steps: [{ title: 'More', owner: 'you', outputFormat: 'link' }],
    }),
  (s, a) => archive(s, ctx(a)),
]

/**
 * Every refusal sentence the transitions give, from every state reachable
 * from a few chains, by every kind of actor.
 */
function refusalSentences(): Set<string> {
  const sentences = new Set<string>()
  const seen = new Set<string>()
  const pending = [chain(['agent', 'you', 'agent']), chain(['you', 'agent'])]
  while (pending.length > 0) {
    const state = pending.shift()!
    const key = JSON.stringify(state)
    if (seen.has(key) || seen.size > 400) continue
    seen.add(key)
    for (const operation of OPERATIONS) {
      for (const actor of ACTORS) {
        const outcome = operation(state, actor)
        if (isRefusal(outcome)) sentences.add(outcome.sentence)
        else pending.push({ task: outcome.task, steps: outcome.steps })
      }
    }
  }
  return sentences
}

function templates(): string[] {
  const queued = { ...chain(['agent', 'you', 'agent']) }
  const claimed = stateOf(claim(queued, ctx(A)))
  const handed = accepted(
    completeStep(claimed, ctx(A), { summary: 'Opened', artifactUrl: 'https://e.com/pr/1' })
  )
  const waiting = { task: handed.task, steps: handed.steps }
  const resumed = stateOf(completeMyStep(waiting, ctx('you')))
  const second = stateOf(claim(resumed, ctx(A)))
  const active = chain(['you'])
  expect(active.task.status).toBe('active')
  return [
    addTaskText(active),
    addTaskText(queued, 'api-server'),
    queueTaskText(active),
    addFollowUpText(active, 1),
    claimStepText(claimed, A),
    claimStepText({ ...second, task: { ...second.task, assignedTo: A } }, A),
    completeStepText(waiting, handed.events),
    completeStepText(waiting, handed.events, 'dedicated'),
    updateStepText(claimed),
    askYouText(claimed),
    blockStepText(claimed),
    unblockStepText(claimed),
    workText({ taskId: 12, assigned: true, handedBack: false, handBack: null }),
    workText({ taskId: 12, assigned: false, handedBack: false, handBack: null }),
    workText({
      taskId: 12,
      assigned: false,
      handedBack: true,
      handBack: { stepNumber: 2, title: 'Review', note: 'Looks good', artifactUrl: null },
    }),
    answeredText('T-012', 'Redis'),
    NO_ANSWER_YET,
    NO_WORK_YET,
    LEFT_THE_BOARD,
    DEDICATED_ASK,
    joinBoardText({ id: A, kind: 'worker', name: 'api-server', minted: true }),
    viewActionText.addTask(active),
    viewActionText.completeMyStep(resumed, []),
    boardSummary({
      ...emptyBoard(new Date('2026-10-01T12:00:00.000Z')),
      yourTurn: [
        {
          task: { id: '12', displayId: 'T-012', title: 'Add caching' },
          step: { number: 2, title: 'Review', owner: 'you', waitingSince: '2026-10-01T12:00:00Z' },
          input: null,
          steps: [],
          canAct: { complete: true, park: true },
        },
      ],
    }),
  ]
}

describe('no second person for the user', () => {
  test.each([
    ['the dedicated instructions', INSTRUCTIONS.dedicated],
    ['the worker instructions', INSTRUCTIONS.worker],
    ...Object.entries(TOOL_DESCRIPTIONS.worker).map(([tool, text]) => [`worker ${tool}`, text]),
    ...Object.entries(TOOL_DESCRIPTIONS.dedicated).map(([tool, text]) => [
      `dedicated ${tool}`,
      text,
    ]),
  ])('%s', (_name, text) => {
    expect(secondPerson(text)).toEqual([])
  })

  test('the text results', () => {
    for (const text of templates()) expect(secondPerson(text), text).toEqual([])
  })

  test('every refusal sentence', () => {
    const sentences = refusalSentences()
    expect(sentences.size).toBeGreaterThan(20)
    for (const sentence of sentences) expect(secondPerson(sentence), sentence).toEqual([])
  })

  test('the word test catches the user addressed as "you"', () => {
    expect(secondPerson('Step 2 waits on you')).toEqual(['you'])
    expect(secondPerson('Your turn')).toEqual(['Your', 'Your turn'])
    expect(secondPerson('ask the person')).toEqual(['the person'])
  })
})
