import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { commands } from 'vitest/browser'

declare module 'vitest/browser' {
  interface BrowserCommands {
    builtView: (entry: string) => Promise<string>
  }
}

const FACES = [
  { family: 'Barlow', weight: 400 },
  { family: 'Barlow', weight: 500 },
  { family: 'Barlow', weight: 700 },
  { family: 'Barlow Condensed', weight: 400 },
  { family: 'Barlow Condensed', weight: 600 },
]

const VIEWS = ['board', 'task']

/**
 * A policy that takes the network away from a frame: it may load nothing but
 * its own inline styles and data: fonts. Taking it away from the whole page
 * would also cut the test runner's own connection.
 */
const NO_NETWORK = "default-src 'none'; style-src 'unsafe-inline'; font-src data:"

/**
 * The built view's stylesheets in a frame of their own, without its script and
 * without the network, so the fonts the frame can use are only the ones that
 * page carries inline.
 */
async function frameWithStylesOf(entry: string) {
  const html = await commands.builtView(entry)
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(([, css]) => css)
  const frame = document.createElement('iframe')
  frame.srcdoc = `<!doctype html>
    <meta http-equiv="Content-Security-Policy" content="${NO_NETWORK}">
    <style>${styles.join('\n')}</style>
    <h1 class="text-title-page">Your turn</h1><p id="body">Add task</p>`
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  document.body.append(frame)
  await loaded
  return frame.contentDocument!
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe.each(VIEWS)('the built %s view', (entry) => {
  let html: string

  beforeAll(async () => {
    html = await commands.builtView(entry)
  }, 120_000)

  test('loads all five faces with the network disabled', async () => {
    expect(html).toContain('@font-face')
    const page = await frameWithStylesOf(entry)

    await expect(page.defaultView!.fetch(location.href)).rejects.toThrow()

    for (const { family, weight } of FACES) {
      const font = `${weight} 16px "${family}"`
      const faces = await page.fonts.load(font)
      expect(faces, font).toHaveLength(1)
      expect(faces[0].status, font).toBe('loaded')
      expect(page.fonts.check(font), font).toBe(true)
    }
  })

  test('a heading computes Barlow Condensed and body text computes Barlow', async () => {
    const page = await frameWithStylesOf(entry)
    const window = page.defaultView!

    const heading = window.getComputedStyle(page.querySelector('h1')!).fontFamily
    const body = window.getComputedStyle(page.getElementById('body')!).fontFamily
    expect(heading.split(',')[0]).toBe('"Barlow Condensed"')
    expect(body.split(',')[0]).toBe('Barlow')
  })
})
