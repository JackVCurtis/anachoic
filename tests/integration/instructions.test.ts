import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { INSTRUCTIONS, TOOL_DESCRIPTIONS } from '../../server/instructions.js'
import { connect, SERVER } from './support/server.js'

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

function initialize(name: string) {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1' } },
  }
}

interface Response {
  id: number
  result?: { instructions?: string; tools?: Array<{ name: string; description: string }> }
  error?: { code: number }
}

test('a client that probes server/discover before initialize still gets its own texts', async () => {
  const child = spawn(process.execPath, [SERVER], {
    cwd: '/',
    env: { ANACHOIC_DATA_DIR: dataDir },
    stdio: ['pipe', 'pipe', 'ignore'],
  })
  const responses: Response[] = []
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    responses.push(...lines.map((line) => JSON.parse(line) as Response))
  })
  const answer = async (message: { id: number; [field: string]: unknown }) => {
    child.stdin.write(`${JSON.stringify(message)}\n`)
    await expect.poll(() => responses.some(({ id }) => id === message.id)).toBe(true)
    return responses.find(({ id }) => id === message.id)!
  }

  try {
    const probe = await answer({ jsonrpc: '2.0', id: 0, method: 'server/discover', params: {} })
    expect(probe.error?.code).toBe(-32601)
    const { result } = await answer(initialize('claude-ai'))
    expect(result?.instructions).toBe(INSTRUCTIONS.dedicated)
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    )
    const listed = await answer({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const ask = listed.result?.tools?.find(({ name }) => name === 'ask_you')
    expect(ask?.description).toBe(TOOL_DESCRIPTIONS.dedicated.ask_you)
  } finally {
    child.kill()
  }
})

test('over --http, an initialize request is answered with the instructions for its client', async () => {
  const port = 40000 + Math.floor(Math.random() * 20000)
  const child = spawn(process.execPath, [SERVER, '--http'], {
    cwd: '/',
    env: { ANACHOIC_DATA_DIR: dataDir, PORT: String(port) },
    stdio: 'ignore',
  })
  const post = async (body: object) => {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    const data = text.split('\n').find((line) => line.startsWith('data: '))
    return JSON.parse(data ? data.slice('data: '.length) : text) as Response
  }

  try {
    await expect
      .poll(() =>
        post(initialize('claude-ai')).then(
          () => true,
          () => false
        )
      )
      .toBe(true)
    const chat = await post(initialize('claude-ai'))
    expect(chat.result?.instructions).toBe(INSTRUCTIONS.dedicated)
    const worker = await post(initialize('claude-code'))
    expect(worker.result?.instructions).toBe(INSTRUCTIONS.worker)
  } finally {
    child.kill()
  }
})
