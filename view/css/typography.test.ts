// Copied from anachoic inertia/css/typography.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import typography from './typography.css?raw'
import barlow400 from '@fontsource/barlow/files/barlow-latin-400-normal.woff?url'
import barlow500 from '@fontsource/barlow/files/barlow-latin-500-normal.woff?url'
import barlow700 from '@fontsource/barlow/files/barlow-latin-700-normal.woff?url'
import condensed400 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-400-normal.woff?url'
import condensed600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff?url'

type Declarations = Map<string, string>

/**
 * The tables of anachoic ui/04-typography-and-fonts.md, "The named scale",
 * at fd99e0d, which this repo does not carry. Only the headings and table rows
 * are kept.
 */
const scaleDoc = `## The named scale

### Titles
| Class | Family | Weight | Size | Line height | Tracking | Used for |
|---|---|---|---|---|---|---|
| \`text-title-page\` | Heading | 600 | 25px | 1.12 | -0.015em | Page titles "Sign off" and "Completed". The workflow name in the chain explorer (line height 1.1 there). |
| \`text-title-panel\` | Heading | 600 | 20px | 1.12 | -0.015em | The task title in the drawer. |
| \`text-title-5\` | Heading | 600 | 19px | 1.2 | 0 | Sign-off card title. |
| \`text-title-4\` | Heading | 600 | 18px | 1.16 | 0 | Your turn card title. |
| \`text-title-3\` | Heading | 600 | 17px | 1.18 | 0 | Agent card title. The empty chat heading. |
| \`text-title-2\` | Heading | 600 | 16px | 1.2 | 0 | Step title in the drawer. |
| \`text-title-1\` | Heading | 600 | 15px | 1.2 | 0 | Queue and Backlog card titles. Workflow name in the list. |
### Labels
| Class | Weight | Size | Tracking | Usual color | Used for |
|---|---|---|---|---|---|
| \`text-section\` | 600 | 12px, line height 1.12 | 0.14em | \`--color-text\` | Section headers: Enter task, Queue, Backlog, Your turn, Agents, Workflows, Workflow agent, Handoff chain. The word that begins a message from the server. |
| \`text-label\` | 400 | 10px | 0.12em | \`--color-text-subtle\` | Field and block labels: Auto-scale, Repo, Workflow, Chain preview, Agent sessions, Follow-up task, Place in queue, Instruction, Input, Prompt, setting keys, chat sender, Show and Hide, the read-only note, the busy label. |
| \`text-note\` | 400 | 10px | 0.10em | varies | The chain note, the pickup label, the Manual cap row, small owner chips, stat labels, artifact kinds. |
| \`text-status\` | 400 | 11px | 0.10em | \`--color-text-subtle\` | Step counters, agent state, repo on a sign-off card, "Finished …", the drawer step label, the chain hint, step status labels, the page label under the Completed table. |
| \`text-name\` | 400 | 13px | 0.10em | varies | Agent names, "Capped", framed empty states. |
| \`text-control\` | 600 | 13px | 0.06em | \`--color-text\` | View tabs, the Workflows link and the pause control. Segments use it at 12px. |
### Plain text
| Class | Family | Weight | Size | Line height | Used for |
|---|---|---|---|---|---|
| \`text-count\` | Heading | 400 | 12px | inherited | The count or summary after a section header. Not uppercase, not tracked. |
| \`text-body\` | Body | 400 | 14px | 1.55 | The default. |
| \`text-body-sm\` | Body | 400 | 13px | inherited | Page summaries, descriptions, prompt fields, suggestions, confirmations, the message from the server. Chat bubbles use it with line height 1.5. |
| \`text-detail\` | Body | 400 | 12px | inherited | Chain preview rows, the activity line on an agent card, stats lines, workflow list meta, the explorer meta row, the chat note. |
| \`text-hint\` | Body | 400 | 11px | inherited | Key hints, validation notes, the note of the deny form, card meta, artifact meta. |
### Monospace
| Class | Size | Line height | Used for |
|---|---|---|---|
| \`text-mono\` | 12px | 1.6 | Custom prompt, step prompt, setting values, the command in the drawer, the source view (line height 1.65). |
| \`text-mono-sm\` | 11.5px | 1.6 | The command on a card, artifact names, chat code, transcripts (line height 1.7). |
| \`text-mono-xs\` | 11px | inherited | Task ids, step indexes, event times, the file name "workflow.yaml". |
### Figures
| Class | Sets | Used for |
|---|---|---|
| \`text-tabular\` | \`font-variant-numeric: tabular-nums\` | Numbers that tick, such as elapsed time on an agent card. It sets no family or size, so it is added beside another style. |
`

/**
 * One row of a named-scale table in ui/04, keyed by its column header.
 */
type StyleRow = { section: string; cells: Map<string, string> }

const STYLESHEETS = import.meta.glob<string>('./**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * The body rule of base.css, which sets the page default that text-body names.
 */
const BODY_RULE = /(?:^|\})\s*body\s*\{([^}]*)\}/

const FAMILIES: Record<string, string> = {
  Titles: 'var(--font-heading)',
  Labels: 'var(--font-heading)',
  Monospace: 'var(--font-mono)',
}

const FAMILY_CELLS: Record<string, string> = {
  Heading: 'var(--font-heading)',
  Body: 'var(--font-body)',
}

const WEIGHTS_IN_USE = {
  'Barlow 400': barlow400,
  'Barlow 500': barlow500,
  'Barlow 700': barlow700,
  'Barlow Condensed 400': condensed400,
  'Barlow Condensed 600': condensed600,
}

function withoutComments(css: string) {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * The declarations that apply to each class, merging the grouped rules
 * (`.a, .b { ... }`) with the class's own rule.
 */
function parseClasses(css: string) {
  const classes = new Map<string, Declarations>()
  for (const [, selectors, body] of withoutComments(css).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const selector of selectors.split(',').map((part) => part.trim())) {
      const name = selector.match(/^\.([a-z0-9-]+)$/)?.[1]
      if (!name) throw new Error(`${selector} is not a single class selector`)
      const declarations = classes.get(name) ?? new Map()
      for (const declaration of body.split(';')) {
        const colon = declaration.indexOf(':')
        if (colon === -1) continue
        const property = declaration.slice(0, colon).trim()
        if (declarations.has(property)) throw new Error(`${property} is set twice on .${name}`)
        declarations.set(property, declaration.slice(colon + 1).trim())
      }
      classes.set(name, declarations)
    }
  }
  return classes
}

/**
 * Every row of the tables under "The named scale" whose first cell is a
 * text style class.
 */
function documentedStyles() {
  const scale = scaleDoc.split('## The named scale')[1].split(/\n## /)[0]
  const rows: StyleRow[] = []
  let section = ''
  let headers: string[] = []
  for (const line of scale.split('\n')) {
    const heading = line.match(/^### (.+)$/)?.[1]
    if (heading) {
      section = heading.trim()
      headers = []
      continue
    }
    const cells = line
      .match(/^\|(.*)\|$/)?.[1]
      .split('|')
      .map((cell) => cell.trim())
    if (!cells) continue
    if (cells[0] === 'Class') {
      headers = cells
      continue
    }
    if (!/^`text-[a-z0-9-]+`$/.test(cells[0])) continue
    rows.push({ section, cells: new Map(headers.map((header, index) => [header, cells[index]])) })
  }
  return rows
}

function className({ cells }: StyleRow) {
  return cells.get('Class')!.slice(1, -1)
}

/**
 * The declarations a row of ui/04 asks for. A size cell may carry its own
 * line height ("12px, line height 1.12"); "inherited" means no declaration.
 */
function expectedDeclarations({ section, cells }: StyleRow) {
  const expected = new Map<string, string | undefined>()
  const family = cells.get('Family')
  expected.set('font-family', family ? FAMILY_CELLS[family] : FAMILIES[section])
  expected.set('font-weight', cells.get('Weight') ?? '400')

  const [size, sizeLineHeight] = cells.get('Size')!.split(/, line height /)
  expected.set('font-size', size)
  const lineHeight = sizeLineHeight ?? cells.get('Line height')
  expected.set('line-height', lineHeight === 'inherited' ? undefined : lineHeight)

  const tracking = cells.get('Tracking')
  if (tracking !== undefined) expected.set('letter-spacing', tracking)

  const color = cells.get('Usual color')?.match(/^`(--[a-z-]+)`$/)?.[1]
  expected.set('color', color ? `var(${color})` : undefined)
  expected.set('text-transform', section === 'Labels' ? 'uppercase' : undefined)
  return expected
}

/**
 * A length or number in one spelling, so that "0.10em" and ".1em" compare equal.
 */
function normalizeLength(value: string | undefined) {
  const match = value?.match(/^(-?[\d.]+)([a-z%]*)$/)
  return match ? `${Number(match[1])}${match[2]}` : value
}

async function inflate(bytes: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function tag(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4))
}

/**
 * The OpenType feature tags in a WOFF 1.0 file's GSUB table. WOFF 1.0
 * compresses each table with zlib unless compression would not shrink it.
 */
async function substitutionFeatures(url: string) {
  const response = await fetch(url)
  const woff = new Uint8Array(await response.arrayBuffer())
  const view = new DataView(woff.buffer)
  const tableCount = view.getUint16(12)
  for (let index = 0; index < tableCount; index++) {
    const entry = 44 + index * 20
    if (tag(woff, entry) !== 'GSUB') continue
    const offset = view.getUint32(entry + 4)
    const compressed = view.getUint32(entry + 8)
    const original = view.getUint32(entry + 12)
    const raw = woff.slice(offset, offset + compressed)
    const gsub = compressed === original ? raw : await inflate(raw)
    const table = new DataView(gsub.buffer)
    const featureList = table.getUint16(6)
    const featureCount = table.getUint16(featureList)
    return new Set(
      Array.from({ length: featureCount }, (_, feature) => tag(gsub, featureList + 2 + feature * 6))
    )
  }
  return new Set<string>()
}

describe('Text styles', () => {
  test('every class listed in ui/04 exists in typography.css', () => {
    const classes = parseClasses(typography)
    const documented = documentedStyles()
    expect(documented.length).toBeGreaterThan(20)
    for (const row of documented) {
      expect(classes.has(className(row)), `.${className(row)} is missing`).toBe(true)
    }
  })

  test('typography.css holds only the classes listed in ui/04', () => {
    const classes = [...parseClasses(typography).keys()].sort()
    const documented = documentedStyles().map(className).sort()
    expect(classes).toEqual(documented)
  })

  test('each style has the family, weight, size, line height, tracking and color in ui/04', () => {
    const classes = parseClasses(typography)
    for (const row of documentedStyles()) {
      if (!row.cells.has('Size')) continue
      const actual = classes.get(className(row))!
      for (const [property, value] of expectedDeclarations(row)) {
        expect(normalizeLength(actual.get(property)), `${property} of .${className(row)}`).toBe(
          normalizeLength(value)
        )
      }
    }
  })

  test('no font-size below 10px appears', () => {
    const sizes = [...withoutComments(typography).matchAll(/font-size:\s*([^;]+);/g)]
    expect(sizes.length).toBeGreaterThan(0)
    for (const [, size] of sizes) {
      const pixels = size.trim().match(/^(\d+(?:\.\d+)?)px$/)?.[1]
      expect(pixels, `${size} is not a pixel size`).toBeDefined()
      expect(Number(pixels), `${size} is below 10px`).toBeGreaterThanOrEqual(10)
    }
  })

  test('no style is italic and only labels are uppercase', () => {
    expect(withoutComments(typography)).not.toMatch(/italic|oblique/)
    const classes = parseClasses(typography)
    for (const row of documentedStyles()) {
      const transform = classes.get(className(row))!.get('text-transform')
      expect(transform, `.${className(row)}`).toBe(
        row.section === 'Labels' ? 'uppercase' : undefined
      )
    }
  })

  test('titles, notes, descriptions and chat wrap with text-wrap: pretty', () => {
    const classes = parseClasses(typography)
    const pretty = [
      'text-title-page',
      'text-title-panel',
      'text-title-5',
      'text-title-4',
      'text-title-3',
      'text-title-2',
      'text-title-1',
      'text-note',
      'text-body-sm',
      'text-detail',
      'text-hint',
    ]
    for (const name of pretty) {
      expect(classes.get(name)!.get('text-wrap'), `.${name}`).toBe('pretty')
    }
  })

  test('colors come from text role tokens only', () => {
    for (const [name, declarations] of parseClasses(typography)) {
      const color = declarations.get('color')
      if (color === undefined) continue
      expect(color, `.${name}`).toMatch(/^var\(--color-text(-[a-z-]+)?\)$/)
    }
  })

  test('the tabular treatment turns on tabular figures', () => {
    const classes = parseClasses(typography)
    expect(classes.get('text-tabular')!.get('font-variant-numeric')).toBe('tabular-nums')
  })

  test('every weight in use offers tabular figures', async () => {
    for (const [weight, url] of Object.entries(WEIGHTS_IN_USE)) {
      const features = await substitutionFeatures(url)
      expect(features.has('tnum'), `${weight} has no tnum feature`).toBe(true)
    }
  })

  test('no stylesheet under view/css but typography.css sets a font size or tracking', () => {
    const files = Object.keys(STYLESHEETS)
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      if (file === './typography.css') continue
      const css = withoutComments(STYLESHEETS[file])
      const rest = file === './base.css' ? css.replace(BODY_RULE, '') : css
      expect(rest, file).not.toMatch(/(^|[\s;{])(font-size|letter-spacing)\s*:/)
    }
  })

  test('the body default in base.css is the text-body size and line height', () => {
    const body = withoutComments(STYLESHEETS['./base.css']).match(BODY_RULE)?.[1]
    expect(body, 'base.css has no body rule').toBeDefined()
    const declarations = new Map(
      body!
        .split(';')
        .filter((declaration) => declaration.includes(':'))
        .map((declaration) => {
          const colon = declaration.indexOf(':')
          return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()]
        })
    )
    const textBody = documentedStyles().find((row) => className(row) === 'text-body')!
    expect(declarations.get('font-size')).toBe(textBody.cells.get('Size'))
    expect(normalizeLength(declarations.get('line-height'))).toBe(
      normalizeLength(textBody.cells.get('Line height'))
    )
    expect(declarations.has('letter-spacing')).toBe(false)
  })
})
