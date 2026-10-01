import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createLogger } from '../../server/logger.js'
import { guarded, refusalResult, textResult, UNEXPECTED_ERROR } from '../../server/results.js'

let logs: string
let stderr: string[]

beforeEach(async () => {
  logs = await mkdtemp(join(tmpdir(), 'anachoic-logs-'))
  stderr = []
})

afterEach(async () => {
  await rm(logs, { recursive: true, force: true })
})

function logger() {
  return createLogger({
    logsDirectory: logs,
    writeStderr: (line) => stderr.push(line),
    now: () => new Date('2026-10-01T12:00:00Z'),
  })
}

async function logLines() {
  const text = await readFile(join(logs, 'server-2026-10-01.log'), 'utf8')
  return text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('results', () => {
  test('a text result has one text block', () => {
    expect(textResult('Done')).toEqual({ content: [{ type: 'text', text: 'Done' }] })
  })

  test("a refusal is an error carrying the refusal's sentence", () => {
    expect(refusalResult({ sentence: 'T-012 does not exist' })).toEqual({
      content: [{ type: 'text', text: 'T-012 does not exist' }],
      isError: true,
    })
  })

  test('a wrapped handler passes its result through', async () => {
    const handler = guarded(logger(), 'example', (name: string) => textResult(`Hello ${name}`))

    expect(await handler('you')).toEqual(textResult('Hello you'))
  })

  test('an unexpected exception returns the fixed sentence and logs the stack', async () => {
    const handler = guarded(logger(), 'example', async () => {
      throw new Error('disk on fire')
    })

    expect(await handler()).toEqual({
      content: [{ type: 'text', text: UNEXPECTED_ERROR }],
      isError: true,
    })
    const [line] = await logLines()
    expect(line).toMatchObject({ event: 'tool_failed', tool: 'example', message: 'disk on fire' })
    expect(line.stack).toContain('disk on fire')
    expect(stderr).toHaveLength(1)
  })
})

describe('logger', () => {
  test('writes the time, pid, session id and event to stderr and the day file', async () => {
    const log = logger()
    log.setSessionId('session-1')
    log.log('example', { count: 2 })

    const [line] = await logLines()
    expect(line).toEqual({
      time: '2026-10-01T12:00:00.000Z',
      pid: process.pid,
      sessionId: 'session-1',
      event: 'example',
      count: 2,
    })
    expect(JSON.parse(stderr[0])).toEqual(line)
  })

  test('truncates questions, answers and notes to 80 characters', async () => {
    const long = 'x'.repeat(200)
    logger().log('example', { question: long, answer: long, note: long, title: long })

    const [line] = await logLines()
    expect(line.question).toBe(`${'x'.repeat(80)}…`)
    expect(line.answer).toBe(`${'x'.repeat(80)}…`)
    expect(line.note).toBe(`${'x'.repeat(80)}…`)
    expect(line.title).toBe(long)
  })
})
