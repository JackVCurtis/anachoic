// Copied from anachoic vitest.config.ts at fd99e0d
import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { BrowserCommand } from 'vitest/node'
import { configDefaults, defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

const BROWSER_CONFIG = './.storybook/vite.config.ts'

/**
 * Clock times and calendar days are local, so the browser's zone and locale
 * are fixed.
 */
const TIME_ZONE = 'UTC'
const LOCALE = 'en-GB'

/**
 * The tests of the time helpers run again in other zones and non-English
 * locales, to show that their wording is English and local whatever the
 * browser. One zone is behind UTC and one ahead of it by a half hour, and the
 * locales write dates, clocks and digits differently from English.
 */
const TIME_HELPER_TESTS = 'view/components/helpers/time.test.ts'
const ABROAD = [
  { name: 'time-los-angeles', timeZone: 'America/Los_Angeles', locale: 'de-DE' },
  { name: 'time-kolkata', timeZone: 'Asia/Kolkata', locale: 'ar-EG' },
]

/**
 * The views built once per run, in a child process, because the view build
 * sets NODE_ENV to production for the process it runs in.
 */
let builtViews: Promise<string> | undefined

function buildViewsOnce() {
  builtViews ??= mkdtemp(join(tmpdir(), 'anachoic-views-')).then(async (outDir) => {
    const script =
      "const { buildViews } = await import('./scripts/build_views.mjs');" +
      'await buildViews({ outDir: process.argv[1] })'
    await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script, outDir], {
      cwd: import.meta.dirname,
    })
    return outDir
  })
  return builtViews
}

/**
 * `builtView(entry)` gives a ui test the HTML the view build writes for that
 * entry.
 */
const builtView: BrowserCommand<[entry: string]> = async (_context, entry) => {
  const outDir = await buildViewsOnce()
  return readFile(join(outDir, `${entry}.html`), 'utf8')
}

/**
 * A fresh object per project, because Vitest writes each project's name into
 * its browser instances.
 */
function chromium(timeZone = TIME_ZONE, locale = LOCALE) {
  return {
    enabled: true,
    headless: true,
    provider: playwright({ contextOptions: { timezoneId: timeZone, locale } }),
    instances: [{ browser: 'chromium' as const }],
  }
}

/**
 * `unit` is domain/, store/ and the server's pure parts in Node, and
 * `integration` the built server driven through an MCP client, also in Node.
 * The browser projects extend the configuration Storybook uses and run in
 * Chromium: `ui` is the view code, `storybook` the library's stories, and
 * each `time-` project the time helpers in another zone and locale.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['./tests/integration/global_setup.ts'],
        },
      },
      {
        extends: BROWSER_CONFIG,
        test: {
          name: 'ui',
          include: ['view/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude],
          setupFiles: ['./view/components/testing/setup.ts'],
          browser: { ...chromium(), commands: { builtView } },
        },
      },
      {
        extends: BROWSER_CONFIG,
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: chromium(),
        },
      },
      ...ABROAD.map(({ name, timeZone, locale }) => ({
        extends: BROWSER_CONFIG,
        test: {
          name,
          include: [TIME_HELPER_TESTS],
          browser: chromium(timeZone, locale),
        },
      })),
    ],
  },
})
