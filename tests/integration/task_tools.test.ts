import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { taskPropsSchema } from '../../shared/props.js'
import { connect, textOf } from './support/server.js'

let dataDir: string
let client: Client

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  client = await connect({ dataDir, clientName: 'claude-ai' })
})

afterEach(async () => {
  await client.close()
  await rm(dataDir, { recursive: true, force: true })
})

async function addTasks(count: number) {
  for (let index = 1; index <= count; index += 1) {
    const result = await client.callTool({
      name: 'add_task',
      arguments: {
        title: `Task ${index}`,
        steps: [
          { title: 'Open the PR', owner: 'agent', output_format: 'pull_request' },
          { title: 'Review it', owner: 'user' },
        ],
      },
    })
    expect(result.isError).toBeFalsy()
  }
}

test('lists open_task with the task view and get_task for the views only', async () => {
  const { tools } = await client.listTools()
  const openTask = tools.find(({ name }) => name === 'open_task')
  const getTask = tools.find(({ name }) => name === 'get_task')

  const { resources } = await client.listResources()
  const taskUri = resources.find(({ uri }) => uri.startsWith('ui://anachoic/task-'))?.uri
  expect(taskUri).toMatch(/^ui:\/\/anachoic\/task-[0-9a-f]{12}\.html$/)
  expect(openTask?._meta).toMatchObject({
    'ui': { resourceUri: taskUri },
    'ui/resourceUri': taskUri,
  })
  expect(getTask?._meta).toMatchObject({ ui: { visibility: ['app'] } })
  expect(getTask?._meta?.ui).not.toHaveProperty('resourceUri')

  const { contents } = await client.readResource({ uri: taskUri! })
  expect(contents[0]).toMatchObject({
    mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { prefersBorder: true } },
  })
  expect('text' in contents[0] && contents[0].text).toMatch(/^<!doctype html>/i)
})

test('open_task on T-012, T-12 and 12 returns the same task, in full text and props', async () => {
  await addTasks(12)
  const results = await Promise.all(
    ['T-012', 'T-12', 12].map((task) => client.callTool({ name: 'open_task', arguments: { task } }))
  )
  for (const result of results) expect(result.isError).toBeFalsy()
  const [first, ...rest] = results
  for (const result of rest) {
    expect(textOf(result)).toBe(textOf(first))
    expect(taskPropsSchema.parse(result.structuredContent)).toEqual({
      ...taskPropsSchema.parse(first.structuredContent),
      now: expect.any(String),
    })
  }

  const lines = textOf(first).split('\n')
  expect(lines[0]).toMatch(
    /^T-012 "Task 12", in the queue at position 12, step 1 of 2, revision \d+$/
  )
  expect(lines).toContain('1. "Open the PR" (agent, not started)')
  expect(lines).toContain('   Produces: a pull request')
  expect(lines).toContain('2. "Review it" (user, not started)')
  const props = taskPropsSchema.parse(first.structuredContent)
  expect(props.task).toMatchObject({ displayId: 'T-012', list: 'queue', queuePosition: 12 })
  expect(props.steps.map(({ outputFormat }) => outputFormat)).toEqual(['pull_request', null])
  expect(props.events.map(({ kind }) => kind)).toEqual(['added', 'queued'])
})

test('open_task on a missing task is refused', async () => {
  const result = await client.callTool({ name: 'open_task', arguments: { task: 'T-012' } })
  expect(result.isError).toBe(true)
  expect(textOf(result)).toBe('T-012 does not exist')
})

test('get_task answers unchanged at the current revision, the props otherwise, and refuses an archived task', async () => {
  await addTasks(1)
  const fresh = await client.callTool({ name: 'get_task', arguments: { task: 'T-001' } })
  const props = taskPropsSchema.parse(fresh.structuredContent)
  expect(textOf(fresh)).toBe(`T-001, revision ${props.revision}`)

  const unchanged = await client.callTool({
    name: 'get_task',
    arguments: { task: 1, sinceRevision: props.revision },
  })
  expect(unchanged.structuredContent).toEqual({ changed: false, revision: props.revision })

  const archived = await client.callTool({ name: 'archive_task', arguments: { task: 'T-001' } })
  expect(archived.isError).toBeFalsy()
  const later = await client.callTool({
    name: 'get_task',
    arguments: { task: 'T-001', sinceRevision: props.revision },
  })
  expect(later.isError).toBe(true)
  expect(textOf(later)).toBe('T-001 was archived')

  const missing = await client.callTool({ name: 'get_task', arguments: { task: 'T-009' } })
  expect(missing.isError).toBe(true)
  expect(textOf(missing)).toBe('T-009 does not exist')
})

test('get_task is a read: it never records the view’s client as a session', async () => {
  await addTasks(1)
  const first = await client.callTool({ name: 'get_task', arguments: { task: 1 } })
  const { revision } = taskPropsSchema.parse(first.structuredContent)
  const again = await client.callTool({
    name: 'get_task',
    arguments: { task: 1, sinceRevision: revision },
  })
  expect(again.structuredContent).toEqual({ changed: false, revision })
})
