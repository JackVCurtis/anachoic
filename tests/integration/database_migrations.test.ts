import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, beforeEach, expect, test } from 'vitest'

const SERVER = resolve(import.meta.dirname, '../../dist/server.js')
const MIGRATIONS = resolve(import.meta.dirname, '../../store/migrations')

let dataDir: string
let serverDir: string

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  serverDir = await mkdtemp(join(tmpdir(), 'anachoic-server-'))
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
  await rm(serverDir, { recursive: true, force: true })
})

test('the built server migrates the database with no .sql file beside it', async () => {
  const server = join(serverDir, 'server.js')
  await copyFile(SERVER, server)
  expect(await readdir(serverDir)).toEqual(['server.js'])

  const client = new Client({ name: 'anachoic-integration', version: '0.0.0' })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [server],
      cwd: '/',
      env: { ANACHOIC_DATA_DIR: dataDir },
      stderr: 'ignore',
    })
  )
  await client.close()

  const database = new DatabaseSync(join(dataDir, 'board.sqlite'), { readOnly: true })
  try {
    const files = await readdir(MIGRATIONS)
    const migrations = files.filter((file) => file.endsWith('.sql'))
    expect(database.prepare('PRAGMA user_version').get()).toEqual({
      user_version: migrations.length,
    })
    expect(database.prepare('SELECT revision, next_task_number FROM board').get()).toEqual({
      revision: 0,
      next_task_number: 1,
    })
  } finally {
    database.close()
  }
})

test('the built server refuses to start on a database a newer server owns', async () => {
  const database = new DatabaseSync(join(dataDir, 'board.sqlite'))
  database.exec('PRAGMA user_version = 999')
  database.close()

  const client = new Client({ name: 'anachoic-integration', version: '0.0.0' })
  await expect(
    client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [SERVER],
        cwd: '/',
        env: { ANACHOIC_DATA_DIR: dataDir },
        stderr: 'ignore',
      })
    )
  ).rejects.toThrow()
})
