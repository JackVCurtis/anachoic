import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  homeFromUserDatabase,
  prepareDataDirectory,
  resolveDataDirectory,
} from '../../server/data_directory.js'

const HOME = userInfo().homedir

describe('resolveDataDirectory', () => {
  test('uses ANACHOIC_DATA_DIR when it is set', () => {
    expect(
      resolveDataDirectory({
        env: { ANACHOIC_DATA_DIR: '/data/anachoic', XDG_DATA_HOME: '/xdg' },
        platform: 'linux',
        userHome: () => '/home/someone',
      })
    ).toEqual({ ok: true, directory: '/data/anachoic' })
  })

  test('refuses a relative ANACHOIC_DATA_DIR', () => {
    expect(
      resolveDataDirectory({
        env: { ANACHOIC_DATA_DIR: 'data' },
        platform: 'darwin',
        userHome: () => '/Users/someone',
      }).ok
    ).toBe(false)
  })

  test('uses Application Support on macOS, from the user database with HOME unset', () => {
    expect(
      resolveDataDirectory({ env: {}, platform: 'darwin', userHome: homeFromUserDatabase })
    ).toEqual({ ok: true, directory: join(HOME, 'Library/Application Support/Anachoic MCP') })
  })

  test('ignores a HOME that disagrees with the user database', () => {
    expect(
      resolveDataDirectory({
        env: { HOME: '/somewhere/else' },
        platform: 'darwin',
        userHome: homeFromUserDatabase,
      })
    ).toEqual({ ok: true, directory: join(HOME, 'Library/Application Support/Anachoic MCP') })
  })

  test('uses XDG_DATA_HOME elsewhere', () => {
    expect(
      resolveDataDirectory({
        env: { XDG_DATA_HOME: '/xdg' },
        platform: 'linux',
        userHome: () => undefined,
      })
    ).toEqual({ ok: true, directory: '/xdg/anachoic-mcp' })
  })

  test("falls back to XDG's default under the home directory elsewhere", () => {
    expect(
      resolveDataDirectory({ env: {}, platform: 'linux', userHome: () => '/home/someone' })
    ).toEqual({ ok: true, directory: '/home/someone/.local/share/anachoic-mcp' })
  })

  test('refuses when neither ANACHOIC_DATA_DIR nor the platform default resolves', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const resolution = resolveDataDirectory({ env: {}, platform, userHome: () => undefined })
      expect(resolution.ok).toBe(false)
      expect(resolution).toHaveProperty('reason', expect.stringContaining('ANACHOIC_DATA_DIR'))
    }
  })
})

describe('prepareDataDirectory', () => {
  let parent: string

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  })

  afterEach(async () => {
    await rm(parent, { recursive: true, force: true })
  })

  test('creates the directory and logs/ readable by the user alone', async () => {
    const { directory, logs } = prepareDataDirectory(join(parent, 'Anachoic MCP'))

    const [directoryStats, logsStats] = await Promise.all([stat(directory), stat(logs)])
    expect(directoryStats.mode & 0o777).toBe(0o700)
    expect(logsStats.mode & 0o777).toBe(0o700)
    expect(logs).toBe(join(directory, 'logs'))
  })
})
