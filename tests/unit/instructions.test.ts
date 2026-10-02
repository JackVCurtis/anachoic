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
    '"I finished"',
    '"I answered"',
    '"I added"',
    '"I moved"',
    '"I signed off"',
    '"I archived"',
    'come from the board view',
    'Reply in one line when the action needs nothing from Claude',
    'Carry on with the work when it concerns work this chat holds or coordinates',
    'Never call wait_for_answer, and never wait in a tool',
    'this chat may claim an agent step like a worker',
    'the answer arrives as a message from the view',
  ])('says %s', (phrase) => {
    expect(text).toContain(phrase)
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
      }
      for (const [tool, phrases] of Object.entries(limits)) {
        for (const phrase of phrases) {
          expect(descriptions[tool as keyof typeof descriptions], tool).toContain(phrase)
        }
      }
      for (const description of Object.values(descriptions))
        expect(description).toContain('Returns')
      for (const tool of ['update_step', 'ask_you', 'complete_step'] as const) {
        expect(descriptions[tool]).toContain('Acts only on a step this session claimed.')
      }
      expect(descriptions.claim_step).toContain('only it can note, ask about or complete it')
    }
  )

  test('the two versions differ in what ask_you says comes next', () => {
    expect(TOOL_DESCRIPTIONS.worker.ask_you).toContain('call wait_for_answer')
    expect(TOOL_DESCRIPTIONS.dedicated.ask_you).toContain('arrives as a message')
    expect(INSTRUCTIONS.dedicated).not.toBe(INSTRUCTIONS.worker)
  })
})
