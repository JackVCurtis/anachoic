import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { prepareHost } from '../../scripts/reference_host.mjs'

/**
 * Builds the views and the server, and the reference host once per pinned
 * commit, before any e2e test runs.
 */
export default function setup() {
  execFileSync('pnpm', ['build'], {
    cwd: resolve(import.meta.dirname, '../..'),
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  prepareHost()
}
