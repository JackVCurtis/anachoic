import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { boardPropsSchema } from '../../shared/props.js'
import { connect, textOf } from './support/server.js'

let dataDir: string
let client: Client
const others: Client[] = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  client = await connect({ dataDir, clientName: 'claude-ai' })
})

afterEach(async () => {
  await Promise.all([client, ...others.splice(0)].map((each) => each.close()))
  await rm(dataDir, { recursive: true, force: true })
})

test('lists show_board with its view and get_board for the view only', async () => {
  const { tools } = await client.listTools()
  const showBoard = tools.find(({ name }) => name === 'show_board')
  const getBoard = tools.find(({ name }) => name === 'get_board')

  const { resources } = await client.listResources()
  const boardUri = resources.find(({ uri }) => uri.startsWith('ui://anachoic/board-'))?.uri
  expect(boardUri).toMatch(/^ui:\/\/anachoic\/board-[0-9a-f]{12}\.html$/)
  expect(showBoard?._meta).toMatchObject({
    'ui': { resourceUri: boardUri },
    'ui/resourceUri': boardUri,
  })
  expect(getBoard?._meta).toMatchObject({ ui: { visibility: ['app'] } })
  expect(getBoard?._meta?.ui).not.toHaveProperty('resourceUri')
})

test('show_board returns the board summary and the board props', async () => {
  const result = await client.callTool({ name: 'show_board', arguments: {} })

  expect(result.isError).toBeFalsy()
  expect(textOf(result).split('\n')).toEqual([
    'Board, revision 1',
    'Waiting on user (0): none',
    'Working (0): none',
    'Queue (0): none',
    'Backlog (0): none',
    'To sign off (0): none',
    'Sessions: This chat',
  ])
  const props = boardPropsSchema.parse(result.structuredContent)
  expect(props.revision).toBe(1)
  expect(props.counts).toEqual({ yourTurn: 0, working: 0, queue: 0, toSignOff: 0 })
  expect(props.sessions).toEqual([
    { id: 'dedicated', kind: 'dedicated', name: 'This chat', live: true },
  ])
})

test('get_board answers unchanged at the current revision and the props otherwise', async () => {
  const unchanged = await client.callTool({ name: 'get_board', arguments: { sinceRevision: 0 } })
  expect(unchanged.structuredContent).toEqual({ changed: false, revision: 0 })
  expect(textOf(unchanged)).toBe('Board, revision 0, unchanged')

  const fresh = await client.callTool({ name: 'get_board', arguments: {} })
  expect(boardPropsSchema.parse(fresh.structuredContent).revision).toBe(0)
  expect(textOf(fresh)).toBe('Board, revision 0')
})

test('get_board is a read: it never records the view’s client as a session', async () => {
  await client.callTool({ name: 'get_board', arguments: {} })
  const again = await client.callTool({ name: 'get_board', arguments: { sinceRevision: 0 } })
  expect(again.structuredContent).toEqual({ changed: false, revision: 0 })
})

test('after a worker adds a task in another process, get_board returns a later board with it', async () => {
  const worker = await connect({
    dataDir,
    clientName: 'claude-code',
    env: { CLAUDE_CODE_SESSION_ID: 'worker-a', CLAUDE_PROJECT_DIR: '/w/api-server' },
  })
  others.push(worker)
  const first = await client.callTool({ name: 'get_board', arguments: {} })
  const { revision } = boardPropsSchema.parse(first.structuredContent)

  await worker.callTool({
    name: 'add_task',
    arguments: { title: 'Add retries', steps: [{ title: 'Write it', owner: 'agent' }] },
  })

  const later = await client.callTool({ name: 'get_board', arguments: { sinceRevision: revision } })
  const props = boardPropsSchema.parse(later.structuredContent)
  expect(props.revision).toBeGreaterThan(revision)
  expect(props.queue).toEqual([
    expect.objectContaining({
      task: { id: '1', displayId: 'T-001', title: 'Add retries', assignedTo: null },
      position: 1,
      nextOwner: 'agent',
    }),
  ])
  expect(props.sessions).toEqual([
    { id: 'worker-a', kind: 'worker', name: 'api-server', live: true },
  ])

  const workerView = await worker.callTool({ name: 'show_board', arguments: {} })
  expect(textOf(workerView)).toContain('Queue (1): 1. T-001 "Add retries" next: agent')
  expect(textOf(workerView)).toContain('Sessions: api-server (live, idle)')
})
