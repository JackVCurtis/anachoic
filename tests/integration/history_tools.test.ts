import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  getHistoryResultSchema,
  historyPropsSchema,
  type HistoryProps,
} from '../../shared/props.js'
import { connect, textOf } from './support/server.js'

let dataDir: string
const clients: Client[] = []
let chat: Client

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  chat = await connect({ dataDir, clientName: 'claude-ai' })
  clients.push(chat)
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function ok(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  expect(result.isError, textOf(result)).toBeFalsy()
  return result
}

/**
 * Adds and signs off `count` tasks of one user step each, T-001 first.
 * Every fifth is titled about the login test.
 */
async function signOffTasks(count: number) {
  for (let index = 1; index <= count; index += 1) {
    const title = index % 5 === 0 ? `Fix the flaky LOGIN test ${index}` : `Task ${index}`
    await ok(chat, 'add_task_from_view', { title, steps: [{ title: 'Do it', owner: 'user' }] })
    await ok(chat, 'complete_my_step', { task: index })
    await ok(chat, 'sign_off', { task: index })
  }
}

async function history(args: Record<string, unknown>): Promise<HistoryProps> {
  const result = await ok(chat, 'get_history', args)
  return historyPropsSchema.parse(result.structuredContent)
}

const ids = (props: HistoryProps) => props.rows.map((row) => row.task.displayId)

test('show_history carries the hashed history resource, and get_history is for the views only', async () => {
  const { tools } = await chat.listTools()
  const showHistory = tools.find(({ name }) => name === 'show_history')
  const getHistory = tools.find(({ name }) => name === 'get_history')

  const { resources } = await chat.listResources()
  const historyUri = resources.find(({ uri }) => uri.startsWith('ui://anachoic/history-'))?.uri
  expect(historyUri).toMatch(/^ui:\/\/anachoic\/history-[0-9a-f]{12}\.html$/)
  expect(showHistory?._meta).toMatchObject({
    'ui': { resourceUri: historyUri },
    'ui/resourceUri': historyUri,
  })
  expect(getHistory?._meta).toMatchObject({ ui: { visibility: ['app'] } })
  expect(getHistory?._meta?.ui).not.toHaveProperty('resourceUri')

  const { contents } = await chat.readResource({ uri: historyUri! })
  expect(contents[0]).toMatchObject({
    mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { prefersBorder: true } },
  })
  expect('text' in contents[0] && contents[0].text).toMatch(/^<!doctype html>/i)
})

test('45 signed-off tasks give 3 pages, newest first, and a filter matches a title or a display id', async () => {
  await signOffTasks(45)
  await ok(chat, 'add_task_from_view', {
    title: 'Still open',
    steps: [{ title: 'x', owner: 'user' }],
  })

  const shown = await ok(chat, 'show_history')
  const first = historyPropsSchema.parse(shown.structuredContent)
  expect(first).toMatchObject({ page: 1, pageCount: 3, total: 45, filter: '' })
  expect(ids(first)).toEqual(
    Array.from({ length: 20 }, (_, index) => `T-${String(45 - index).padStart(3, '0')}`)
  )
  const lines = textOf(shown).split('\n')
  expect(lines[0]).toBe('45 completed tasks')
  expect(lines[1]).toMatch(/^T-045 “Fix the flaky LOGIN test 45” · signed off \d{1,2} \w{3}$/)
  expect(lines.at(-1)).toBe('Page 1 of 3; the History view pages through the rest.')

  const third = await history({ page: 3 })
  expect(third.page).toBe(3)
  expect(ids(third)).toEqual(['T-005', 'T-004', 'T-003', 'T-002', 'T-001'])
  expect(third.rows[0]).toMatchObject({
    task: { title: 'Fix the flaky LOGIN test 5' },
    steps: [{ owner: 'you', status: 'done', sessionName: null }],
    workers: [],
    artifacts: [],
  })

  const pastTheEnd = await history({ page: 7 })
  expect(pastTheEnd.page).toBe(3)
  expect(ids(pastTheEnd)).toEqual(ids(third))

  const login = await history({ page: 1, filter: 'login' })
  expect(login).toMatchObject({ total: 9, pageCount: 1, filter: 'login' })
  expect(ids(login)).toEqual(
    [45, 40, 35, 30, 25, 20, 15, 10, 5].map((n) => `T-${String(n).padStart(3, '0')}`)
  )

  const byId = await history({ page: 1, filter: 't-7' })
  expect(ids(byId)).toEqual(['T-007'])
  expect(ids(await history({ page: 1, filter: 'T-007' }))).toEqual(['T-007'])

  const filtered = await ok(chat, 'show_history', { filter: 'LOGIN TEST 4' })
  expect(textOf(filtered).split('\n')).toEqual([
    '2 completed tasks match “LOGIN TEST 4”',
    expect.stringMatching(/^T-045 /),
    expect.stringMatching(/^T-040 /),
  ])

  const none = await history({ page: 2, filter: 'nothing like this' })
  expect(none).toMatchObject({ page: 1, pageCount: 1, total: 0, rows: [] })
})

test('get_history answers unchanged at the same revision, and in full once the board moves on', async () => {
  await signOffTasks(1)
  const first = await history({ page: 1 })

  const same = await ok(chat, 'get_history', { page: 1, sinceRevision: first.revision })
  expect(getHistoryResultSchema.parse(same.structuredContent)).toEqual({
    changed: false,
    revision: first.revision,
  })

  await ok(chat, 'add_task_from_view', { title: 'Next', steps: [{ title: 'x', owner: 'user' }] })
  const moved = await ok(chat, 'get_history', { page: 1, sinceRevision: first.revision })
  expect(historyPropsSchema.parse(moved.structuredContent).revision).toBeGreaterThan(first.revision)
})

test('a row names the workers that completed its agent steps, and its artifacts', async () => {
  const api = await connect({
    dataDir,
    clientName: 'claude-code',
    env: { CLAUDE_CODE_SESSION_ID: 'worker-a', CLAUDE_PROJECT_DIR: '/w/api-server' },
  })
  clients.push(api)
  await ok(chat, 'add_task', {
    title: 'Cache',
    steps: [
      { title: 'Open the PR', owner: 'agent', output_format: 'pull_request' },
      { title: 'Review it', owner: 'user' },
    ],
  })
  await ok(api, 'claim_step', { task: 'T-001' })
  await ok(api, 'complete_step', {
    task: 'T-001',
    summary: 'Opened',
    artifact_url: 'https://github.com/acme/app/pull/7',
  })
  await ok(chat, 'complete_my_step', { task: 1 })
  await ok(chat, 'sign_off', { task: 1 })

  const { rows } = await history({ page: 1 })
  const [row] = rows
  expect(row).toMatchObject({
    workers: ['api-server'],
    artifacts: [
      { stepNumber: 1, format: 'pull_request', url: 'https://github.com/acme/app/pull/7' },
    ],
  })
  expect(textOf(await ok(chat, 'show_history')).split('\n')[1]).toMatch(/· 1 link$/)
})

test('the board summary’s Done line mentions the history once more than 10 tasks are signed off', async () => {
  await signOffTasks(11)
  const lines = textOf(await ok(chat, 'show_board')).split('\n')
  expect(lines).toContain(
    'Done (11): T-011, T-010, T-009, T-008, T-007, T-006, T-005, T-004, T-003, T-002, and 1 more; show_history lists every completed task'
  )
})
