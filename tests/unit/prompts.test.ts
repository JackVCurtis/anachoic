import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { withPrompts, writePrompts } from '../../scripts/manifest.mjs'
import { INSTRUCTIONS } from '../../server/instructions.js'
import { manifestPrompts, PROMPTS } from '../../shared/prompts.mjs'

const MANIFEST = resolve(import.meta.dirname, '../../mcpb/manifest.json')

test('the board and history prompts, as 14 names them', () => {
  expect(PROMPTS).toEqual([
    { name: 'board', title: 'Show the board', text: 'Show the Anachoic board.' },
    { name: 'history', title: 'Show the history', text: 'Show the Anachoic history.' },
  ])
})

test('the packed manifest’s prompts equal the served prompts', () => {
  const declared = JSON.parse(readFileSync(MANIFEST, 'utf8')).prompts
  expect(declared).toEqual(manifestPrompts())
  expect(declared).toEqual(
    PROMPTS.map(({ name, title, text }) => ({ name, description: title, text }))
  )
})

test('pack writes the prompts into a manifest, and leaves a matching one untouched', () => {
  const directory = mkdtempSync(join(tmpdir(), 'anachoic-manifest-'))
  try {
    const path = join(directory, 'manifest.json')
    writeFileSync(path, JSON.stringify({ name: 'anachoic', prompts: [{ name: 'old', text: 'x' }] }))
    expect(writePrompts(path)).toEqual(withPrompts({ name: 'anachoic' }))
    const written = readFileSync(path, 'utf8')
    expect(JSON.parse(written).prompts).toEqual(manifestPrompts())

    writeFileSync(path, ` ${written}`)
    writePrompts(path)
    expect(readFileSync(path, 'utf8')).toBe(` ${written}`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test.each(['dedicated', 'worker'] as const)(
  'the %s instructions say which tool each prompt’s message calls',
  (kind) => {
    expect(INSTRUCTIONS[kind]).toContain(
      'when the user\'s message is "Show the Anachoic board.", call show_board. When it is "Show the Anachoic history.", call show_history'
    )
  }
)
