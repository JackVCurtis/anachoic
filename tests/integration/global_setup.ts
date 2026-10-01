import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * The integration tests drive the built server, and the server as the
 * extension lays it out, so both are built once before any of them run.
 * Packing runs the build first.
 */
export default function setup() {
  execFileSync('pnpm', ['run', 'pack'], {
    cwd: resolve(import.meta.dirname, '../..'),
    stdio: ['ignore', 'inherit', 'inherit'],
  })
}
