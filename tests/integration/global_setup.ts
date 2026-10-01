import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * The integration tests drive the built server, so it is built once before
 * any of them run.
 */
export default function setup() {
  execFileSync('pnpm', ['build'], {
    cwd: resolve(import.meta.dirname, '../..'),
    stdio: ['ignore', 'inherit', 'inherit'],
  })
}
