import { describe, expect, test } from 'vitest'
import { hostVariableNames, kindOfClient, resolveIdentity } from '../../server/identity.js'

const CLAUDE_CODE = { name: 'claude-code', version: '2.1.285' }
const DESKTOP_CHAT = { name: 'claude-ai', version: '0.1.0' }
const WORKER_ENV = { CLAUDE_CODE_SESSION_ID: 'e261', CLAUDE_PROJECT_DIR: '/Users/jack/api-server' }

describe('resolveIdentity', () => {
  test('Claude Code with CLAUDE_CODE_SESSION_ID is a worker with that id and project', () => {
    expect(resolveIdentity(CLAUDE_CODE, WORKER_ENV)).toEqual({
      source: 'client',
      identity: { id: 'e261', kind: 'worker', projectDir: '/Users/jack/api-server' },
    })
  })

  test('Claude Code ignores a session argument when its process names the session', () => {
    expect(resolveIdentity(CLAUDE_CODE, WORKER_ENV, 'other')).toMatchObject({
      source: 'client',
      identity: { id: 'e261' },
    })
  })

  test('Claude Code with no project directory is a worker with none', () => {
    expect(resolveIdentity(CLAUDE_CODE, { CLAUDE_CODE_SESSION_ID: 'e261' })).toEqual({
      source: 'client',
      identity: { id: 'e261', kind: 'worker', projectDir: null },
    })
  })

  test.each([{}, { CLAUDE_CODE_SESSION_ID: '' }, { CLAUDE_CODE_SESSION_ID: 'you' }])(
    'Claude Code without a usable CLAUDE_CODE_SESSION_ID (%j) is given a minted id',
    (env) => {
      expect(resolveIdentity(CLAUDE_CODE, env)).toEqual({ source: 'mint' })
      expect(resolveIdentity(CLAUDE_CODE, env, 'minted-1')).toEqual({
        source: 'session',
        id: 'minted-1',
      })
    }
  )

  test('desktop chat is the dedicated session, whatever the environment or the arguments', () => {
    const dedicated = {
      source: 'client',
      identity: { id: 'dedicated', kind: 'dedicated', projectDir: null },
    }
    expect(resolveIdentity(DESKTOP_CHAT, {})).toEqual(dedicated)
    expect(resolveIdentity(DESKTOP_CHAT, WORKER_ENV, 'minted-1')).toEqual(dedicated)
  })

  test.each([
    { name: 'local-agent-mode-Anachoic', version: '1.0.0' },
    { name: 'Anachoic-era-probe', version: '1.0.0' },
    { name: 'basic-host' },
    undefined,
  ])('an unknown client %j is a worker with a minted id, or the one it passes', (client) => {
    expect(resolveIdentity(client, WORKER_ENV)).toEqual({ source: 'mint' })
    expect(resolveIdentity(client, {}, 'minted-1')).toEqual({ source: 'session', id: 'minted-1' })
  })
})

describe('kindOfClient', () => {
  test('desktop chat is dedicated and every other client a worker', () => {
    expect(kindOfClient(DESKTOP_CHAT)).toBe('dedicated')
    expect(kindOfClient(CLAUDE_CODE)).toBe('worker')
    expect(kindOfClient({ name: 'basic-host' })).toBe('worker')
    expect(kindOfClient(undefined)).toBe('worker')
  })
})

describe('hostVariableNames', () => {
  test('keeps only the names a Claude host or MCP sets, sorted, without their values', () => {
    expect(
      hostVariableNames({
        PATH: '/bin',
        HOME: '/Users/jack',
        CLAUDE_PROJECT_DIR: '/w',
        ANTHROPIC_API_KEY: 'secret',
        MCP_TIMEOUT: '1',
        CLAUDE_CODE_SESSION_ID: 'e261',
        ANACHOIC_DATA_DIR: '/d',
      })
    ).toEqual(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_PROJECT_DIR', 'MCP_TIMEOUT'])
  })
})
