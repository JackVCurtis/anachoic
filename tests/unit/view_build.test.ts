import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { buildViews, VIEW_ENTRIES } from '../../scripts/build_views.mjs'

let outDir: string

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'anachoic-views-'))
  await buildViews({ outDir })
}, 60_000)

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true })
})

/**
 * The page with each inline script's body removed, so text inside the bundled
 * JavaScript is not mistaken for markup.
 */
function markup(html: string) {
  return html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
}

describe.each(VIEW_ENTRIES)('the built %s view', (entry) => {
  test('loads nothing from outside its own file', async () => {
    const html = markup(await readFile(join(outDir, `${entry}.html`), 'utf8'))

    expect(html).not.toMatch(/<script[^>]*\ssrc=/i)
    expect(html).not.toMatch(/<link[^>]*rel=["']?stylesheet/i)
    expect(html).not.toMatch(/url\(\s*["']?(?!data:)/i)
  })
})

test('a woff2 font imported by an entry is inlined as a data: URL', async () => {
  const html = await readFile(join(outDir, 'board.html'), 'utf8')

  expect(html).toMatch(/url\(\s*["']?data:font\/woff2;base64,/)
})
