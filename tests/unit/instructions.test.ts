import { describe, expect, test } from 'vitest'
import { INSTRUCTIONS, TOOL_DESCRIPTIONS } from '../../server/instructions.js'

const APP_ONLY_TOOLS = [
  'get_board',
  'get_task',
  'add_task_from_view',
  'queue_task_from_view',
  'reorder_queue',
  'move_to_backlog',
  'complete_my_step',
  'answer_question',
  'sign_off',
  'add_follow_up_from_view',
  'archive_task',
  'remove_session',
]

function sentences(text: string) {
  return text.split(/(?<=[.:])\s+/)
}

function mentions(text: string, name: string) {
  return new RegExp(String.raw`(?<![\w])${name}(?![\w])`).test(text)
}

describe('the dedicated session’s instructions', () => {
  const text = INSTRUCTIONS.dedicated

  test.each([
    'call show_board whenever the person asks about work',
    'plan work as tasks with chains of steps, through add_task',
    'Give each step an owner: "you"',
    '"agent"',
    'Tasks cannot be edited once added, and a chain changes only by add_follow_up on a done task that is not signed off',
    'Never call wait_for_answer, and never wait in a tool',
    'this chat may claim an agent step like a worker',
    "It is unblocked in that worker's session, by the worker, not by this chat",
    "This chat learns of the person's board actions only by calling show_board",
    'asks the person questions directly in this chat, never with ask_you',
  ])('says %s', (phrase) => {
    expect(text).toContain(phrase)
  })

  test.each([
    '"I finished"',
    '"I answered"',
    'Messages from the board view',
    'arrives as a message',
  ])('no longer says %s', (phrase) => {
    expect(text).not.toContain(phrase)
  })

  test('mentions wait_for_answer only to forbid it', () => {
    const about = sentences(text).filter((sentence) => sentence.includes('wait_for_answer'))
    expect(about.length).toBeGreaterThan(0)
    for (const sentence of about) expect(sentence).toMatch(/^Never call wait_for_answer/)
  })
})

describe('a worker’s instructions', () => {
  const text = INSTRUCTIONS.worker

  test.each([
    'call join_board first, with a short name that fits the project',
    'pass it as session on every later call',
    'claim one step at a time with claim_step',
    'Report progress with update_step',
    'ask the person only through ask_you followed by wait_for_answer, never in your own chat',
    'Call wait_for_answer again whenever it says "No answer yet"',
    'complete the step with complete_step, a summary of what was done and links',
    'When complete_step says to call claim_step with the task, do so to continue the chain',
    'Never insert a step',
    'ask the person with ask_you instead',
    'not_yours',
    'archived',
    'wrong_status',
    'stop work on a task',
    'wait_for_answer says the task was parked or your claim ended',
    "when complete_step says the next step is the person's, call wait_for_work and keep calling it",
    'call block_step with a clear reason, then end your turn',
    'call unblock_step and carry on',
    'before this session is closed on purpose, call leave_board',
  ])('says %s', (phrase) => {
    expect(text).toContain(phrase)
  })
})

describe('both versions', () => {
  test.each(['dedicated', 'worker'] as const)(
    'the %s instructions and descriptions mention no app-only tool',
    (kind) => {
      const texts = [INSTRUCTIONS[kind], ...Object.values(TOOL_DESCRIPTIONS[kind])]
      for (const name of APP_ONLY_TOOLS) {
        for (const each of texts) expect(mentions(each, name), name).toBe(false)
      }
    }
  )

  test('the dedicated descriptions never mention wait_for_answer', () => {
    for (const description of Object.values(TOOL_DESCRIPTIONS.dedicated)) {
      expect(description).not.toContain('wait_for_answer')
    }
  })

  test.each(['dedicated', 'worker'] as const)(
    'each %s description names its inputs’ limits and its text result',
    (kind) => {
      const descriptions = TOOL_DESCRIPTIONS[kind]
      const limits: Record<string, string[]> = {
        join_board: ['1–40 characters'],
        add_task: ['1–200 characters', '1–20 steps', 'up to 4,000 characters'],
        add_follow_up: ['1–20'],
        update_step: ['1–500 characters', 'up to 10'],
        ask_you: ['1–2,000 characters'],
        complete_step: ['1–2,000 characters', 'up to 10'],
        block_step: ['1–2,000 characters'],
        unblock_step: ['up to 500 characters'],
      }
      for (const [tool, phrases] of Object.entries(limits)) {
        for (const phrase of phrases) {
          expect(descriptions[tool as keyof typeof descriptions], tool).toContain(phrase)
        }
      }
      for (const description of Object.values(descriptions))
        expect(description).toContain('Returns')
      for (const tool of [
        'update_step',
        'ask_you',
        'complete_step',
        'block_step',
        'unblock_step',
      ] as const) {
        expect(descriptions[tool]).toContain('Acts only on a step this session claimed.')
      }
      expect(descriptions.claim_step).toContain('only it can note, ask about or complete it')
    }
  )

  test('ask_you is for workers only, and the dedicated version says it is refused', () => {
    expect(TOOL_DESCRIPTIONS.worker.ask_you).toMatch(/^For worker sessions only\./)
    expect(TOOL_DESCRIPTIONS.worker.ask_you).toContain('call wait_for_answer')
    expect(TOOL_DESCRIPTIONS.dedicated.ask_you).toMatch(/^For worker sessions only\./)
    expect(TOOL_DESCRIPTIONS.dedicated.ask_you).toContain('"Ask in this chat instead"')
    expect(TOOL_DESCRIPTIONS.dedicated.wait_for_answer).toContain('"This chat does not wait"')
    expect(INSTRUCTIONS.dedicated).not.toBe(INSTRUCTIONS.worker)
  })
})
