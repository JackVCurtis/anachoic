import { DatabaseSync } from 'node:sqlite'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { expect } from 'vitest'

export const SERVER = resolve(import.meta.dirname, '../../../dist/server.js')

export interface ConnectOptions {
  dataDir: string
  /** The name the client gives in initialize: claude-code, claude-ai or another. */
  clientName?: string
  env?: Record<string, string>
}

/**
 * Starts the built server as its own process, with an empty environment
 * apart from the data directory and `env`, and connects a client to it.
 */
export async function connect({
  dataDir,
  clientName = 'anachoic-integration',
  env = {},
}: ConnectOptions): Promise<Client> {
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
  return client
}

export function textOf(result: { content?: unknown }): string {
  const content = result.content as Array<{ type: string; text?: string }>
  expect(content).toHaveLength(1)
  expect(content[0].type).toBe('text')
  return content[0].text!
}

/**
 * Runs a read against the board's database, as a separate connection.
 */
export function query<T>(dataDir: string, sql: string, ...params: Array<string | number>): T[] {
  const database = new DatabaseSync(join(dataDir, 'board.sqlite'), { readOnly: true })
  try {
    return database.prepare(sql).all(...params) as T[]
  } finally {
    database.close()
  }
}
