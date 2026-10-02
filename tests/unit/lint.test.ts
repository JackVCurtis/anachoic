import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'

const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '../..') })

async function errors(filePath: string, code: string) {
  const [result] = await eslint.lintText(`${code}\n`, { filePath })
  return result.messages.filter((message) => message.severity === 2)
}

// The first lint loads the whole config, which is slow while other suites run.
describe('lint refuses', { timeout: 30_000 }, () => {
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
      'a drag-and-drop package in a component',
      'view/components/board/queue_section/queue_section.tsx',
      "import { DndContext } from '@dnd-kit/core'",
    ],
    [
      'a drag-and-drop package in a view entry',
      'view/entries/board/board_entry.tsx',
      "import Sortable from 'sortablejs'",
    ],
    [
      'updateModelContext in view/',
      'view/bridge/example.ts',
      "app.updateModelContext({ content: [{ type: 'text', text: 'hi' }] })",
    ],
    [
      'sendMessage in view/',
      'view/entries/board/example.ts',
      "app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'hi' }] })",
    ],
  ])('%s', async (_name, filePath, code) => {
    expect(await errors(filePath, code)).not.toEqual([])
  })
})

describe('lint allows', { timeout: 30_000 }, () => {
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

describe('lint of the CSS modules in view/components/', { timeout: 30_000 }, () => {
  const MODULE = 'view/components/patterns/example/example.module.css'

  test.each([
    ['a hex colour', '.a {\n  color: #1d1f20;\n}'],
    ['an rgba() colour', '.a {\n  background: rgba(0, 0, 0, 0.2);\n}'],
    [
      'color-mix() outside tokens.css',
      '.a {\n  color: color-mix(in srgb, var(--color-text) 10%, transparent);\n}',
    ],
    ['a named colour', '.a {\n  border-color: white;\n}'],
    ['a font family by name', '.a {\n  font-family: Barlow, sans-serif;\n}'],
    ['a terminal token', '.a {\n  color: var(--terminal-fg);\n}'],
    ['a raw duration', '.a {\n  transition: opacity 150ms;\n}'],
    ['a gap in px wider than a hairline', '.a {\n  gap: 8px;\n}'],
    ['a margin in px wider than a hairline', '.a {\n  margin-top: 6px;\n}'],
  ])('refuses %s', async (_name, css) => {
    const found = await errors(MODULE, css)
    expect(found.map((message) => message.ruleId)).toEqual(['anachoic-css/tokens'])
    expect(found[0].line).toBe(2)
  })

  test('allows tokens, hairline gaps, control padding and a colour in a comment', async () => {
    const css = [
      '/* #1d1f20 is the ink, named here only */',
      '.a {',
      '  padding: 3px 10px;',
      '  gap: 2px;',
      '  margin-top: var(--gap-stack);',
      '  color: var(--tone-fg-subtle);',
      '  font-family: var(--font-heading);',
      '  transition: opacity var(--motion-quick);',
      '}',
    ].join('\n')
    expect(await errors(MODULE, css)).toEqual([])
  })
})
