// Copied from anachoic inertia/components/helpers/strings.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { commands } from 'vitest/browser'
import {
  assistive,
  backlog,
  boardHeader,
  done,
  fillTemplate,
  queue,
  sessions,
  strings,
  taskEntry,
  taskView,
  times,
  yourTurn,
} from './strings'

function valuesOf(group: object): string[] {
  return Object.values(group).flatMap((value: unknown) => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value as string[]
    return valuesOf(value as object)
  })
}

/**
 * Every string in the catalogue, with the path it is found at.
 */
function catalogue(): Array<{ path: string; value: string }> {
  const entries: Array<{ path: string; value: string }> = []
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      entries.push({ path, value: node })
    } else if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}.${index}`))
    } else {
      for (const [key, value] of Object.entries(node as object)) {
        walk(value, path === '' ? key : `${path}.${key}`)
      }
    }
  }
  walk(strings, '')
  return entries
}

const ALL = catalogue()

/**
 * This repo's UI port document, read at run time: view code may not import
 * from docs/.
 */
const uiPort = await commands.readFile('docs/architecture/07-ui-port.md')

const VALUES = new Set(valuesOf(strings))

/**
 * The words quoted in the list under "New words" in 07's Content section.
 */
function newWords(): string[] {
  const content = uiPort.split('\n## Content')[1].split('\n## ')[0]
  const list = content.split('**New words:**')[1].split('\n\n')[1]
  return [...list.matchAll(/"([^"]+)"/g)].map(([, word]) => word)
}

describe('the words of 07', () => {
  test.each(newWords())('the catalogue holds the new word "%s"', (word) => {
    expect(newWords().length).toBeGreaterThanOrEqual(8)
    expect(VALUES).toContain(word)
  })

  test("the board header's counts, its update cue and its error line", () => {
    expect(boardHeader.yourTurn).toBe('Your turn')
    expect(boardHeader.working).toBe('Working')
    expect(boardHeader.queue).toBe('Queue')
    expect(boardHeader.toSignOff).toBe('To sign off')
    expect(boardHeader.updated).toBe('Updated')
    expect(boardHeader.cantReach).toBe("Can't reach the board")
  })

  test('each section of the board has its title', () => {
    expect([
      yourTurn.title,
      sessions.title,
      queue.title,
      backlog.title,
      done.title,
      strings.working.title,
    ]).toEqual(['Your turn', 'Sessions', 'Queue', 'Backlog', 'Done', 'Working'])
  })

  test('the time words are kept as anachoic has them', () => {
    expect(valuesOf(times)).toEqual(
      expect.arrayContaining(['just now', '—', 'today {time}', 'yesterday', 'Yesterday {time}'])
    )
  })

  test('the assistive strings keep the pip summary, the moves, the waits and the questions', () => {
    expect(Object.keys(assistive)).toEqual(
      expect.arrayContaining([
        'pipSummaryIntro',
        'pipDone',
        'pipRunning',
        'pipWaiting',
        'pipNotStarted',
        'moveDescription',
        'moveLifted',
        'moveMoved',
        'moveDropped',
        'moveCancelled',
        'moveLeftQueue',
        'waitingOnYou',
        'sessionAsks',
        'questionForYou',
        'waitingForSignOff',
        'blockedIn',
      ])
    )
  })

  test('the strings of what this app does not have are gone', () => {
    for (const { value } of ALL) {
      expect(value).not.toMatch(/\b(?:cap|tmux|approv|paused?|(?:workflow)s?|repo)\b/i)
    }
  })
})

describe('voice and punctuation', () => {
  test.each(ALL)('$path has no three full stops', ({ value }) => {
    expect(value).not.toContain('...')
  })

  test.each(ALL)('$path has no straight double quote', ({ value }) => {
    expect(value).not.toContain('"')
  })

  test.each(ALL)('$path opens and closes its curly quotes', ({ value }) => {
    expect(value.split('“').length).toBe(value.split('”').length)
    expect(value.indexOf('”')).toBeGreaterThanOrEqual(value.indexOf('“'))
  })

  test.each(ALL)('$path has no exclamation mark and no emoji', ({ value }) => {
    expect(value).not.toContain('!')
    expect(value).not.toMatch(/\p{Emoji_Presentation}/u)
  })

  test.each(ALL)('$path does not say please, user or human', ({ value }) => {
    expect(value).not.toMatch(/please/i)
    expect(value).not.toMatch(/\busers?\b/i)
    expect(value).not.toMatch(/\bhumans?\b/i)
  })

  test.each(ALL)('$path names no grant and no notify setting', ({ value }) => {
    expect(value).not.toMatch(/grant/i)
    expect(value).not.toMatch(/notif/i)
  })

  test.each(ALL)('$path is not fully uppercase', ({ value }) => {
    const letters = value.replace(/\{[^{}]*\}/g, '').replace(/[^\p{L}]/gu, '')
    const uppercase = letters.length > 1 && letters === letters.toUpperCase()
    expect(uppercase).toBe(false)
  })

  test.each(ALL)('$path puts one space each side of a middle dot', ({ value }) => {
    const dots = value.split('·').length - 1
    const spaced = value.split(/(?<=[^ ] )·(?= [^ ])/).length - 1
    expect(spaced).toBe(dots)
  })

  test.each(ALL)('$path puts one space before ↗', ({ value }) => {
    const arrows = value.split('↗').length - 1
    const spaced = value.split(/(?<=[^ ] )↗/).length - 1
    expect(spaced).toBe(arrows)
  })

  test.each(ALL)('$path has no stray spaces', ({ value }) => {
    expect(value).toBe(value.trim())
    expect(value).not.toContain('  ')
  })

  /**
   * The confirmations, and what a screen reader speaks.
   */
  const FULL_SENTENCES = new Set(['yourTurn.parkQuestion', 'done.archiveQuestion'])

  test.each(ALL.filter(({ path }) => !FULL_SENTENCES.has(path) && !path.startsWith('assistive.')))(
    '$path ends without a full stop',
    ({ value }) => {
      expect(value.endsWith('.')).toBe(false)
    }
  )
})

describe('symbols', () => {
  test('use their exact code points', () => {
    expect(taskEntry.chainNote).toContain(' · ')
    expect(backlog.toQueue).toBe('Queue →')
    expect(queue.position).toBe('#{n} in line')
    expect(assistive.moveLifted).toContain('“{title}”')
    expect(times.none).toBe('—')
    expect(taskView.stepDoneAt).toBe('Done · {time}')
  })

  test('have hidden companion text', () => {
    expect(assistive.opensInNewTab).toBe('opens in a new tab')
    expect(assistive.none).toBe('none')
    expect(assistive.close).toBe('Close')
  })
})

describe('fillTemplate', () => {
  test.each([
    { template: boardHeader.updatedAt, values: { time: '09:41' }, expected: 'Updated 09:41' },
    { template: yourTurn.stepCounter, values: { n: 2, m: 4 }, expected: 'Step 2/4' },
    {
      template: sessions.releasedTasks,
      values: { 'n tasks': '3 tasks' },
      expected: 'Released 3 tasks',
    },
    {
      template: yourTurn.asks,
      values: { session: 'api-server' },
      expected: 'api-server asks',
    },
    {
      template: sessions.holding,
      values: { 'n': 2, 'm': 3, 'step title': 'Write the migration' },
      expected: 'Step 2 of 3 · Write the migration',
    },
    {
      template: sessions.blockedOn,
      values: { id: 'T-012', n: 2 },
      expected: 'Blocked on T-012 step 2',
    },
    {
      template: yourTurn.unblockIn,
      values: { session: 'api-server' },
      expected: 'Unblock it in api-server’s session',
    },
    {
      template: assistive.blockedIn,
      values: { id: 'T-012', session: 'api-server' },
      expected: 'T-012 is blocked in api-server',
    },
    { template: queue.title, values: {}, expected: 'Queue' },
  ])('$template gives "$expected"', ({ template, values, expected }) => {
    expect(fillTemplate(template, values as never)).toBe(expected)
  })

  test('leaves a placeholder with no value as written', () => {
    expect(fillTemplate('{a} and {b}', { a: 1 } as never)).toBe('1 and {b}')
  })

  test('asks for every placeholder of the template', () => {
    expect(fillTemplate(backlog.showAll, { n: 14 })).toBe('Show all 14')
    // @ts-expect-error `m` is missing.
    expect(fillTemplate(yourTurn.stepCounter, { n: 1 })).toBe('Step 1/{m}')
  })
})
