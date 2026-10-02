import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'

const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '../..') })

async function errors(filePath: string, code: string) {
  const [result] = await eslint.lintText(`${code}\n`, { filePath })
  return result.messages.filter((message) => message.severity === 2)
}

describe('lint refuses', () => {
  test.each([
    [
      'the MCP SDK in a component',
      'view/components/patterns/example/example.tsx',
      "import { App } from '@modelcontextprotocol/ext-apps'",
    ],
    [
      'the host bridge in a primitive',
      'view/components/primitives/example/example.tsx',
      "import { app } from '../../../bridge/app.js'",
    ],
    [
      'the host bridge in a board component',
      'view/components/board/board_view/board_view.tsx',
      "import { HostContextProvider } from '../../../bridge/host_context'",
    ],
    [
      'a pattern in a primitive',
      'view/components/primitives/example/example.tsx',
      "import { Other } from '../../patterns/other/other.js'",
    ],
    [
      'fixtures in a component',
      'view/components/patterns/example/example.tsx',
      "import { FIXED_NOW } from '../../fixtures/clock'",
    ],
    [
      'the library fixtures in a view entry',
      'view/entries/board/board_entry.tsx',
      "import { BUSY_BOARD } from '../../components/fixtures/board'",
    ],
    ['a barrel file in the library', 'view/components/primitives/index.ts', 'export {}'],
    [
      'lucide-react outside the Icon primitive',
      'view/entries/board/main.tsx',
      "import { Plus } from 'lucide-react'",
    ],
    ['store/ in domain/', 'domain/example.ts', "import { open } from '../store/db.js'"],
    ['node:fs in domain/', 'domain/example.ts', "import { readFileSync } from 'node:fs'"],
    ['node:sqlite in domain/', 'domain/example.ts', "import { DatabaseSync } from 'node:sqlite'"],
    [
      'server/ in view/',
      'view/entries/board/main.tsx',
      "import { start } from '../../../server/main.js'",
    ],
    ['console.log in server/', 'server/example.ts', "console.log('hello')"],
    [
      'updateModelContext in view/',
      'view/bridge/example.ts',
      "app.updateModelContext({ content: [{ type: 'text', text: 'hi' }] })",
    ],
  ])('%s', async (_name, filePath, code) => {
    expect(await errors(filePath, code)).not.toEqual([])
  })
})

describe('lint allows', () => {
  test.each([
    [
      'a view entry importing the bridge and shared/',
      'view/entries/board/main.tsx',
      "import { app } from '../../bridge/app.js'\nimport { ids } from '../../../shared/ids.js'",
    ],
    [
      'server/ importing domain/ and store/',
      'server/example.ts',
      "import { rules } from '../domain/rules.js'\nimport { open } from '../store/db.js'",
    ],
    [
      'lucide-react in the Icon primitive',
      'view/components/primitives/icon/icon.tsx',
      "import { Plus } from 'lucide-react'",
    ],
    [
      "an entry's fixtures importing the library fixtures",
      'view/entries/board/fixtures.ts',
      "import { BUSY_BOARD } from '../../components/fixtures/board'",
    ],
  ])('%s', async (_name, filePath, code) => {
    expect(await errors(filePath, code)).toEqual([])
  })
})
