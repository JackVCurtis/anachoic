import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { connect as connectTcp } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { test as base, expect, type FrameLocator, type Page } from '@playwright/test'
import { startHost } from '../../../scripts/reference_host.mjs'
import {
  REFERENCE_HOST_PORT,
  REFERENCE_SANDBOX_PORT,
} from '../../../scripts/reference_host_version.mjs'

const SERVER = resolve(import.meta.dirname, '../../../dist/server.js')
const HTTP_PORT = 3001
const HOST_URL = `http://localhost:${REFERENCE_HOST_PORT}/index.html`

/**
 * Resolves once something accepts connections on the port, or throws.
 */
async function untilListening(port: number, host: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const open = await new Promise<boolean>((settle) => {
      const socket = connectTcp(port, host)
      socket.once('connect', () => {
        socket.destroy()
        settle(true)
      })
      socket.once('error', () => settle(false))
    })
    if (open) return
    if (Date.now() > deadline) throw new Error(`Nothing listens on ${host}:${port}`)
    await sleep(100)
  }
}

/**
 * Stops a process started detached, with everything it started, and waits
 * for it to exit.
 */
async function stopGroup(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise<void>((settle) => child.once('exit', () => settle()))
  try {
    process.kill(-child.pid!, 'SIGTERM')
  } catch {
    return
  }
  await Promise.race([exited, sleep(5000)])
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid!, 'SIGKILL')
    } catch {
      // Already gone.
    }
    await exited
  }
}

/**
 * The board as one test has it: the server over --http on 127.0.0.1:3001,
 * which the reference host's page talks to, and the server's other
 * processes over stdio, all on one temporary data directory.
 */
export interface Board {
  dataDir: string
  /** The dedicated session, as desktop chat would start it. */
  chat(): Promise<Client>
  /** A worker session, as Claude Code would start it. */
  worker(id: string, project: string): Promise<Client>
  query<T>(sql: string, ...params: Array<string | number>): T[]
  revision(): number
}

export async function ok(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ text?: string }>
  expect(result.isError, content[0]?.text).toBeFalsy()
  return result
}

export const test = base.extend<{ board: Board }, { referenceHost: void }>({
  referenceHost: [
    async ({}, use) => {
      const host = startHost([`http://127.0.0.1:${HTTP_PORT}/mcp`], {
        detached: true,
        stdio: 'ignore',
      })
      try {
        await untilListening(REFERENCE_HOST_PORT, 'localhost')
        await untilListening(REFERENCE_SANDBOX_PORT, 'localhost')
        await use()
      } finally {
        await stopGroup(host)
      }
    },
    { scope: 'worker', auto: true },
  ],

  board: async ({}, use) => {
    const dataDir = await mkdtemp(join(tmpdir(), 'anachoic-e2e-'))
    const server = spawn(process.execPath, [SERVER, '--http'], {
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir, PORT: String(HTTP_PORT) },
      detached: true,
      stdio: 'ignore',
    })
    const clients: Client[] = []

    async function open(clientName: string, env: Record<string, string> = {}) {
      const client = new Client({ name: clientName, version: '0.0.0' })
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [SERVER],
          cwd: '/',
          env: { ANACHOIC_DATA_DIR: dataDir, ...env },
          stderr: 'ignore',
        })
      )
      clients.push(client)
      return client
    }

    function query<T>(sql: string, ...params: Array<string | number>): T[] {
      const database = new DatabaseSync(join(dataDir, 'board.sqlite'), { readOnly: true })
      try {
        return database.prepare(sql).all(...params) as T[]
      } finally {
        database.close()
      }
    }

    try {
      await untilListening(HTTP_PORT, '127.0.0.1')
      await use({
        dataDir,
        chat: () => open('claude-ai'),
        worker: (id, project) =>
          open('claude-code', { CLAUDE_CODE_SESSION_ID: id, CLAUDE_PROJECT_DIR: `/w/${project}` }),
        query,
        revision: () => query<{ revision: number }>('SELECT revision FROM board')[0].revision,
      })
    } finally {
      await Promise.all(clients.map((client) => client.close().catch(() => {})))
      await stopGroup(server)
      await rm(dataDir, { recursive: true, force: true })
    }
  },
})

export { expect }

/**
 * Calls a tool from the reference host's form, as a person trying a view
 * would, and gives the view's own frame, inside the host's sandbox frame.
 */
export async function callFromHost(
  page: Page,
  tool: string,
  input: Record<string, unknown> = {}
): Promise<FrameLocator> {
  await page.goto(HOST_URL)
  const toolSelect = page.getByLabel('Tool')
  await expect(toolSelect.locator(`option[value="${tool}"]`)).toBeAttached()
  await toolSelect.selectOption(tool)
  await page.getByLabel('Input').fill(JSON.stringify(input))
  await page.getByRole('button', { name: 'Call Tool' }).click()
  return page.frameLocator('iframe').frameLocator('iframe')
}

/**
 * True for a request from the host page to the server that calls `tool`.
 */
export function callsTool(postData: string | null, tool: string): boolean {
  if (postData === null) return false
  try {
    const message = JSON.parse(postData) as { method?: string; params?: { name?: string } }
    return message.method === 'tools/call' && message.params?.name === tool
  } catch {
    return false
  }
}
