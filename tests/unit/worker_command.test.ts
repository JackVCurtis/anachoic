import { describe, expect, test } from 'vitest'
import {
  DEV_DATA_DIR,
  DEV_SERVER,
  printWorkerCommand,
  quotePath,
  workerCommand,
} from '../../scripts/print_worker_command.mjs'

const HOME = '/Users/someone'
const FOLDER = `${HOME}/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic`
const SERVER = `${FOLDER}/server/server.js`
const MANIFEST = {
  name: 'anachoic',
  author: { name: 'Jack Curtis' },
  server: {
    mcp_config: {
      env: { ANACHOIC_DATA_DIR: '${HOME}/Library/Application Support/Anachoic MCP' },
    },
  },
}

function run(argv: string[], options: { installed?: boolean; nodeVersion?: string } = {}) {
  const { installed = true } = options
  const nodeVersion = 'nodeVersion' in options ? options.nodeVersion : 'v24.21.0'
  return printWorkerCommand({
    argv,
    home: HOME,
    exists: (path: string) => installed || path === DEV_SERVER,
    readManifest: () => MANIFEST,
    nodeVersion: () => nodeVersion,
    manifest: MANIFEST,
  })
}

describe('quotePath', () => {
  test('quotes a path with spaces as one shell word', () => {
    expect(quotePath('/opt/My Apps/server.js', HOME)).toBe('"/opt/My Apps/server.js"')
  })

  test('writes a path under the home directory from $HOME', () => {
    expect(quotePath(`${HOME}/Library/Application Support/x`, HOME)).toBe(
      '"$HOME/Library/Application Support/x"'
    )
  })

  test('escapes the characters the shell expands inside double quotes', () => {
    expect(quotePath('/a/$b/`c`/"d"/\\e', HOME)).toBe('"/a/\\$b/\\`c\\`/\\"d\\"/\\\\e"')
  })
})

describe('the printed command', () => {
  test('adds the installed server at user scope with the manifest data directory', () => {
    expect(run([])).toEqual({
      code: 0,
      stdout:
        'claude mcp add --scope user anachoic -e ANACHOIC_DATA_DIR="$HOME/Library/Application Support/Anachoic MCP" -- node "$HOME/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/server/server.js"',
      stderr: [],
    })
  })

  test('uses project scope with --project, with no timeout', () => {
    const { stdout } = run(['--project'])
    expect(stdout).toMatch(/^claude mcp add --scope project anachoic /)
    expect(stdout).not.toMatch(/timeout/i)
  })

  test('points at dist/server.js and a scratch data directory with --dev', () => {
    expect(run(['--dev'], { installed: false }).stdout).toBe(
      workerCommand({
        name: 'anachoic-dev',
        scope: 'user',
        serverPath: DEV_SERVER,
        dataDir: DEV_DATA_DIR,
        home: HOME,
      })
    )
    expect(DEV_DATA_DIR).toMatch(/\.cache\/dev-data$/)
  })

  test('says in one line that the extension is missing, and fails', () => {
    const { code, stdout, stderr } = run([], { installed: false })
    expect(code).not.toBe(0)
    expect(stdout).toBe('')
    expect(stderr).toEqual([
      `The Anachoic extension is not installed at ${FOLDER}. Install anachoic.mcpb in Claude desktop first.`,
    ])
  })

  test.each([['v22.12.0'], [undefined]])('warns when node on the PATH is %s', (version) => {
    const { code, stderr } = run([], { nodeVersion: version })
    expect(code).toBe(0)
    expect(stderr).toHaveLength(1)
    expect(stderr[0]).toMatch(/node 24 or newer/)
  })

  test('does not warn for node 24 or newer', () => {
    expect(run([], { nodeVersion: 'v25.0.0' }).stderr).toEqual([])
  })
})

test('the server path it checks is the one in the command', () => {
  const checked: string[] = []
  printWorkerCommand({
    home: HOME,
    exists: (path: string) => (checked.push(path), true),
    readManifest: () => MANIFEST,
    nodeVersion: () => 'v24.21.0',
    manifest: MANIFEST,
  })
  expect(checked).toContain(SERVER)
})

describe('--hook', () => {
  test('prints the hooks.SessionEnd settings entry for the installed server, as JSON', () => {
    const { code, stdout } = run(['--hook'])
    expect(code).toBe(0)
    expect(JSON.parse(stdout)).toEqual({
      hooks: {
        SessionEnd: [
          {
            hooks: [
              {
                type: 'command',
                command:
                  'ANACHOIC_DATA_DIR="$HOME/Library/Application Support/Anachoic MCP" node "$HOME/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/server/server.js" --session-ended',
                timeout: 5,
              },
            ],
          },
        ],
      },
    })
  })

  test('with --dev points at dist/server.js and the scratch data directory', () => {
    const { command } = JSON.parse(run(['--hook', '--dev'], { installed: false }).stdout).hooks
      .SessionEnd[0].hooks[0]
    expect(command).toContain(DEV_SERVER.replace(HOME, '$HOME'))
    expect(command).toMatch(/--session-ended$/)
  })
})
