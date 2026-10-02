import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { INSTRUCTIONS, TOOL_DESCRIPTIONS } from '../../server/instructions.js'
import { connect } from './support/server.js'

let dataDir: string
const clients: Client[] = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function start(clientName: string, env: Record<string, string> = {}) {
  const client = await connect({ dataDir, clientName, env })
  clients.push(client)
  return client
}

async function descriptions(client: Client) {
  const { tools } = await client.listTools()
  return Object.fromEntries(tools.map(({ name, description }) => [name, description]))
}

test('desktop chat is sent the dedicated instructions and descriptions', async () => {
  const chat = await start('claude-ai')

  expect(chat.getInstructions()).toBe(INSTRUCTIONS.dedicated)
  expect(await descriptions(chat)).toMatchObject(TOOL_DESCRIPTIONS.dedicated)
})

test.each([
  ['claude-code', { CLAUDE_CODE_SESSION_ID: 'worker-a' }],
  ['claude-code', {}],
  ['some-other-client', {}],
])('%s with %j is sent the worker instructions and descriptions', async (name, env) => {
  const worker = await start(name, env)

  expect(worker.getInstructions()).toBe(INSTRUCTIONS.worker)
  expect(await descriptions(worker)).toMatchObject(TOOL_DESCRIPTIONS.worker)
})

test('the two kinds of client list different descriptions', async () => {
  const [chat, worker] = await Promise.all([start('claude-ai'), start('claude-code')])
  const [forChat, forWorker] = await Promise.all([descriptions(chat), descriptions(worker)])

  expect(forChat.ask_you).not.toBe(forWorker.ask_you)
  expect(forChat.show_board).not.toBe(forWorker.show_board)
  expect(forChat.add_task).toBe(forWorker.add_task)
})
