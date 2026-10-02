import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect } from './support/server.js'

const PACKAGE = resolve(import.meta.dirname, '../../anachoic.mcpb')

let dataDir: string
let client: Client

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await client.close()
  await rm(dataDir, { recursive: true, force: true })
})

/** The prompts the packed .mcpb declares in its manifest. */
function packedPrompts(): Array<{ name: string; description: string; text: string }> {
  return JSON.parse(execFileSync('unzip', ['-p', PACKAGE, 'manifest.json'], { encoding: 'utf8' }))
    .prompts
}

test.each(['claude-ai', 'claude-code'])(
  'prompts/list lists board and history, and prompts/get returns their exact text, for %s',
  async (clientName) => {
    client = await connect({ dataDir, clientName })

    const { prompts } = await client.listPrompts()
    expect(prompts.map(({ name, title, arguments: args }) => ({ name, title, args }))).toEqual([
      { name: 'board', title: 'Show the board', args: undefined },
      { name: 'history', title: 'Show the history', args: undefined },
    ])

    for (const [name, text] of [
      ['board', 'Show the Anachoic board.'],
      ['history', 'Show the Anachoic history.'],
    ]) {
      const { messages } = await client.getPrompt({ name })
      expect(messages).toEqual([{ role: 'user', content: { type: 'text', text } }])
    }
  }
)

test('the packed manifest declares exactly the served prompts', async () => {
  client = await connect({ dataDir, clientName: 'claude-ai' })
  const { prompts } = await client.listPrompts()
  const served = await Promise.all(
    prompts.map(async ({ name, description }) => {
      const { messages } = await client.getPrompt({ name })
      const [{ content }] = messages
      return { name, description, text: content.type === 'text' ? content.text : null }
    })
  )
  expect(packedPrompts()).toEqual(served)
})
