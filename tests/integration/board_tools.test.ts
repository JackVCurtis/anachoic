import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { boardPropsSchema } from '../../shared/props.js'

const SERVER = resolve(import.meta.dirname, '../../dist/server.js')

let dataDir: string
let client: Client

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  client = new Client({ name: 'anachoic-integration', version: '0.0.0' })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir },
      stderr: 'ignore',
    })
  )
})

afterEach(async () => {
  await client.close()
  await rm(dataDir, { recursive: true, force: true })
})

function textOf(result: { content?: unknown }) {
  const content = result.content as Array<{ type: string; text?: string }>
  expect(content).toHaveLength(1)
  expect(content[0].type).toBe('text')
  return content[0].text!
}

test('lists show_board with its view and get_board for the view only', async () => {
  const { tools } = await client.listTools()
  const showBoard = tools.find(({ name }) => name === 'show_board')
  const getBoard = tools.find(({ name }) => name === 'get_board')

  expect(showBoard?._meta).toMatchObject({
    'ui': { resourceUri: 'ui://anachoic/board.html' },
    'ui/resourceUri': 'ui://anachoic/board.html',
  })
  expect(getBoard?._meta).toMatchObject({ ui: { visibility: ['app'] } })
  expect(getBoard?._meta?.ui).not.toHaveProperty('resourceUri')
})

test('show_board returns the board summary and the board props', async () => {
  const result = await client.callTool({ name: 'show_board', arguments: {} })

  expect(result.isError).toBeFalsy()
  const text = textOf(result)
  expect(text.split('\n')).toEqual([
    'Board, revision 0',
    'Your turn (0): none',
    'Working (0): none',
    'Queue (0): none',
    'Backlog (0): none',
    'To sign off (0): none',
    'Sessions: none',
  ])
  const props = boardPropsSchema.parse(result.structuredContent)
  expect(props.revision).toBe(0)
  expect(props.counts).toEqual({ yourTurn: 0, working: 0, queue: 0, toSignOff: 0 })
})

test('get_board answers unchanged at the current revision and the props otherwise', async () => {
  const unchanged = await client.callTool({ name: 'get_board', arguments: { sinceRevision: 0 } })
  expect(unchanged.structuredContent).toEqual({ changed: false, revision: 0 })
  expect(textOf(unchanged)).toBe('Board, revision 0, unchanged')

  const fresh = await client.callTool({ name: 'get_board', arguments: {} })
  expect(boardPropsSchema.parse(fresh.structuredContent).revision).toBe(0)
  expect(textOf(fresh)).toBe('Board, revision 0')
})
