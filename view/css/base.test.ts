// Copied from anachoic inertia/css/base.test.ts at fd99e0d
/// <reference types="@vitest/browser-playwright" />

import './app.css'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cdp, userEvent } from 'vitest/browser'

/**
 * Stands in for a component module: a rule outside every cascade layer that
 * runs the blink, frozen at the midpoint of its cycle.
 */
const BLINKER_CSS = `
.blinker {
  animation: blink var(--motion-blink-attention) infinite;
  animation-delay: calc(var(--motion-blink-attention) / -2);
  animation-play-state: paused;
}
`

function mount(html: string) {
  document.body.innerHTML = html
}

/**
 * The computed color a token resolves to at the given element, found by
 * painting a probe with it.
 */
function resolvedColor(token: string, within: Element = document.body) {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  within.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

function byId(id: string) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`No element #${id}`)
  return element
}

/**
 * The style rules that apply in this browser, taken from inside every layer,
 * every matching @supports block and every @import.
 */
function styleRules(rules: CSSRuleList): CSSStyleRule[] {
  return [...rules].flatMap((rule) => {
    if (rule instanceof CSSStyleRule) return [rule]
    if (rule instanceof CSSImportRule)
      return rule.styleSheet ? styleRules(rule.styleSheet.cssRules) : []
    if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) return []
    if (rule instanceof CSSGroupingRule) return styleRules(rule.cssRules)
    return []
  })
}

async function emulateReducedMotion(reduce: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  })
}

beforeEach(() => {
  ;(document.activeElement as HTMLElement | null)?.blur()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('body and elements', () => {
  test('body is the ground, in ink, in 14px Barlow at line height 1.55', () => {
    const body = getComputedStyle(document.body)

    expect(body.backgroundColor).toBe(resolvedColor('--color-bg'))
    expect(body.color).toBe(resolvedColor('--color-text'))
    expect(body.fontFamily).toContain('Barlow')
    expect(body.fontSize).toBe('14px')
    expect(body.lineHeight).toBe(`${14 * 1.55}px`)
    expect(body.margin).toBe('0px')
  })

  test('every element uses border-box sizing', () => {
    mount('<div id="box"></div>')

    expect(getComputedStyle(byId('box')).boxSizing).toBe('border-box')
    expect(getComputedStyle(byId('box'), '::before').boxSizing).toBe('border-box')
  })

  test('a heading has no margin and takes its type from its parent', () => {
    mount('<h1 id="h1">Title</h1><h6 id="h6">Label</h6><p id="p">Text</p>')

    for (const id of ['h1', 'h6', 'p']) {
      const style = getComputedStyle(byId(id))
      expect(style.margin, id).toBe('0px')
      expect(style.fontSize, id).toBe('14px')
      expect(style.fontWeight, id).toBe('400')
      expect(style.fontFamily, id).toBe(getComputedStyle(document.body).fontFamily)
    }
  })

  test('a link is accent-700 and turns to the accent on hover', async () => {
    mount('<a id="link" href="#here">Link</a>')
    const link = byId('link')

    expect(getComputedStyle(link).color).toBe(resolvedColor('--color-accent-700'))

    await userEvent.hover(link)
    expect(getComputedStyle(link).color).toBe(resolvedColor('--color-accent'))
  })

  test('selected text is tinted with the selection tint', () => {
    mount('<p id="p">Selected</p>')

    expect(getComputedStyle(byId('p'), '::selection').backgroundColor).toBe(
      resolvedColor('--tint-selection')
    )
  })
})

describe('focus ring', () => {
  test.each([
    ['light', '<button id="button">Go</button>'],
    ['inverse', '<div data-tone="inverse"><button id="button">Go</button></div>'],
  ])('keyboard focus on the %s tone draws 2px of --tone-focus at offset 2px', async (_, html) => {
    mount(html)
    const button = byId('button')

    await userEvent.tab()

    expect(document.activeElement).toBe(button)
    const style = getComputedStyle(button)
    expect(style.outlineStyle).toBe('solid')
    expect(style.outlineWidth).toBe('2px')
    expect(style.outlineOffset).toBe('2px')
    expect(style.outlineColor).toBe(resolvedColor('--tone-focus', button.parentElement!))
  })

  test('the two tones draw the ring in different colors', () => {
    mount('<div id="light"></div><div id="inverse" data-tone="inverse"></div>')

    expect(resolvedColor('--tone-focus', byId('light'))).toBe(resolvedColor('--color-accent'))
    expect(resolvedColor('--tone-focus', byId('inverse'))).toBe(resolvedColor('--color-accent-300'))
  })

  test.each([
    ['light', '<button id="button">Go</button>'],
    ['inverse', '<div data-tone="inverse"><button id="button">Go</button></div>'],
  ])('pointer focus on the %s tone draws no ring', async (_, html) => {
    mount(html)
    const button = byId('button')

    await userEvent.click(button)

    expect(document.activeElement).toBe(button)
    expect(getComputedStyle(button).outlineStyle).toBe('none')
  })
})

describe('blink and reduced motion', () => {
  beforeEach(() => {
    mount(`<style>${BLINKER_CSS}</style><span id="square" class="blinker"></span>`)
  })

  afterEach(async () => {
    await emulateReducedMotion(false)
  })

  test('the blink dims to --opacity-blink-low halfway through its cycle', () => {
    const square = getComputedStyle(byId('square'))

    expect(square.animationName).toBe('blink')
    expect(Number(square.opacity)).toBeCloseTo(0.25)
  })

  test('with reduced motion the blink stops and the square stays at full opacity', async () => {
    await emulateReducedMotion(true)

    const square = byId('square')
    expect(getComputedStyle(square).animationDuration).toBe('0s')
    expect(square.getAnimations()).toHaveLength(0)
    expect(getComputedStyle(square).opacity).toBe('1')
  })

  test('with reduced motion the quick transition is instant', async () => {
    const root = document.documentElement
    expect(getComputedStyle(root).getPropertyValue('--motion-quick').trim()).toBe('0.15s')

    await emulateReducedMotion(true)

    expect(getComputedStyle(root).getPropertyValue('--motion-quick').trim()).toBe('0s')
  })
})

describe('scrollbars', () => {
  test('Chromium applies a 9px square neutral-400 WebKit scrollbar', () => {
    const rules = [...document.styleSheets].flatMap((sheet) => styleRules(sheet.cssRules))
    const bar = rules.find((rule) => rule.selectorText === '::-webkit-scrollbar')
    const thumb = rules.find((rule) => rule.selectorText === '::-webkit-scrollbar-thumb')
    const rootStyle = getComputedStyle(document.documentElement)

    expect(bar?.style.width).toBe('var(--size-scrollbar)')
    expect(bar?.style.height).toBe('var(--size-scrollbar)')
    expect(rootStyle.getPropertyValue('--size-scrollbar').trim()).toBe('9px')
    expect(thumb?.style.background).toBe('var(--color-neutral-400)')
    expect(thumb?.style.borderRadius).toBe('0px')
  })

  test('the standard scrollbar properties stay unset where the WebKit rules apply', () => {
    mount('<div id="box"></div>')

    expect(CSS.supports('selector(::-webkit-scrollbar)')).toBe(true)
    expect(getComputedStyle(byId('box')).scrollbarWidth).toBe('auto')
  })
})

/**
 * The conditions of every @media rule in the global CSS, from inside every
 * layer and every @import.
 */
function mediaConditions(rules: CSSRuleList): string[] {
  return [...rules].flatMap((rule) => {
    if (rule instanceof CSSImportRule)
      return rule.styleSheet ? mediaConditions(rule.styleSheet.cssRules) : []
    if (rule instanceof CSSMediaRule) return [rule.conditionText, ...mediaConditions(rule.cssRules)]
    if (rule instanceof CSSGroupingRule) return mediaConditions(rule.cssRules)
    return []
  })
}

function globalStyleRules() {
  return [...document.styleSheets].flatMap((sheet) => styleRules(sheet.cssRules))
}

describe('the frame', () => {
  test('no rule gives html, body or the view root a height, so the document grows with its content', () => {
    const ours = [...document.styleSheets].filter((sheet) =>
      (sheet.ownerNode as HTMLElement | null)?.dataset.viteDevId?.includes('/view/css/')
    )
    const rules = ours.flatMap((sheet) => styleRules(sheet.cssRules))

    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      const selectors = rule.selectorText.split(',').map((selector) => selector.trim())
      if (!selectors.some((selector) => ['html', 'body', '#app', ':root'].includes(selector)))
        continue
      expect(rule.style.height, rule.selectorText).toBe('')
      expect(rule.style.minHeight, rule.selectorText).toBe('')
    }
  })

  test('the layout tokens take their defaults: 1100 by 700, and 180px for the rail lists', () => {
    const root = getComputedStyle(document.documentElement)

    expect(root.getPropertyValue('--layout-min-width').trim()).toBe('1100px')
    expect(root.getPropertyValue('--layout-min-height').trim()).toBe('700px')
    expect(root.getPropertyValue('--layout-rail-lists-min').trim()).toBe('180px')
  })

  test('no media query reflows the layout: the only ones ask for a user preference', () => {
    const conditions = [...document.styleSheets].flatMap((sheet) => mediaConditions(sheet.cssRules))

    expect(conditions.length).toBeGreaterThan(0)
    for (const condition of conditions) {
      expect(condition).toMatch(/^\(prefers-[a-z-]+: [a-z-]+\)$/)
    }
  })

  test('nothing global sets a maximum width, a stacking order or a sticky position', () => {
    for (const rule of globalStyleRules()) {
      const properties = [...rule.style]
      expect(properties, rule.selectorText).not.toContain('max-width')
      expect(properties, rule.selectorText).not.toContain('z-index')
      expect(
        properties.filter((name) => name.startsWith('--z')),
        rule.selectorText
      ).toEqual([])
      expect(rule.style.position, rule.selectorText).not.toBe('sticky')
    }
  })
})
