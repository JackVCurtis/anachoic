import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { boardPropsSchema } from '../../shared/props.js'

const EXTENSION_SERVER = resolve(import.meta.dirname, '../../mcpb/server/server.js')

let dataDir: string

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

test('the server laid out for the extension starts as desktop starts it and shows the board', async () => {
  const client = new Client({ name: 'claude-ai', version: '0.0.0' })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [EXTENSION_SERVER],
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir },
      stderr: 'ignore',
    })
  )

  const result = await client.callTool({ name: 'show_board', arguments: {} })
  const [content] = result.content as Array<{ type: string; text: string }>
  // The first call records the dedicated session, which moves the revision to 1.
  expect(content.text.startsWith('Board, revision 1\n')).toBe(true)
  expect(boardPropsSchema.parse(result.structuredContent).revision).toBe(1)

  const { tools } = await client.listTools()
  const uri = tools.find(({ name }) => name === 'show_board')?._meta?.ui as { resourceUri: string }
  expect(uri.resourceUri).toMatch(/^ui:\/\/anachoic\/board-[0-9a-f]{12}\.html$/)
  const { contents } = await client.readResource({ uri: uri.resourceUri })
  expect('text' in contents[0] && contents[0].text).toMatch(/^<!doctype html>/i)

  await client.close()
})
