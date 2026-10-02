import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MARKETPLACE_NAME = 'anachoic'
export const PLUGIN_NAME = 'anachoic-worker'

/**
 * The plugin's manifest: the MCP server and the SessionEnd hook that removes
 * the worker from the board when its session ends, both running the server
 * bundled in the plugin. Neither sets ANACHOIC_DATA_DIR: the server's default
 * data directory is the one desktop's extension uses too, so both share one
 * board.
 */
export function pluginManifest({ manifest, version }) {
  return {
    name: PLUGIN_NAME,
    displayName: 'Anachoic worker',
    version,
    description:
      'Joins this Claude Code session to the Anachoic board as a worker, and removes it from the board when the session ends.',
    author: manifest.author,
    mcpServers: {
      [manifest.name]: {
        command: 'node',
        args: ['${CLAUDE_PLUGIN_ROOT}/server/server.js'],
      },
    },
    hooks: {
      SessionEnd: [
        {
          hooks: [
            {
              type: 'command',
              command: 'node "${CLAUDE_PLUGIN_ROOT}/server/server.js" --session-ended',
              timeout: 5,
            },
          ],
        },
      ],
    },
  }
}

export function marketplaceManifest({ manifest, version }) {
  return {
    name: MARKETPLACE_NAME,
    owner: { name: manifest.author.name },
    description: 'A local marketplace holding the Anachoic worker plugin, built by pnpm run pack.',
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./${PLUGIN_NAME}`,
        description:
          'The Anachoic MCP server for worker sessions, with a SessionEnd hook that removes the worker from the board.',
        version,
      },
    ],
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Lays out a local marketplace in `out`: its manifest, and the worker plugin
 * with the built server and views from `dist`.
 *
 *   out/.claude-plugin/marketplace.json
 *   out/anachoic-worker/.claude-plugin/plugin.json
 *   out/anachoic-worker/server/server.js
 *   out/anachoic-worker/server/views/*.html
 */
/** The MCP server's tools as the plugin names them, for the command's allowed-tools. */
const PLUGIN_TOOLS = `mcp__plugin_${PLUGIN_NAME}_anachoic`

/**
 * /worker: joins this Claude Code session to the board and keeps it taking
 * work. The server's worker instructions say how each step is done; this
 * only starts the loop. allowed-tools covers this plugin's board tools only.
 */
export const WORKER_COMMAND = `---
description: Join the Anachoic board as a worker and keep taking work from it
argument-hint: [worker name]
allowed-tools: ${PLUGIN_TOOLS}
---
Start working as a worker on the Anachoic board, using the anachoic server's tools and following its instructions.

1. Call join_board with the name "$ARGUMENTS". If that name is empty, use a short name that fits this project, such as its folder or repository name.
2. Call claim_step with no task. When it claims a step, do the step as the instructions say: report progress with update_step, ask the user only with ask_you then wait_for_answer, block with block_step when the user must act with you here, finish a step that produces an artifact with complete_step and its artifact_url, and finish any other step with complete_step. When complete_step says to claim the task again, do so.
3. When there is nothing to claim, or a step is handed to the user, call wait_for_work and keep calling it until it names a task, then claim that task.
4. Go back to step 2. Keep going until the user interrupts you. Before this session is closed on purpose, call leave_board.
`

export function buildPlugin({ dist, out, manifest, version }) {
  rmSync(out, { recursive: true, force: true })
  const plugin = join(out, PLUGIN_NAME)
  mkdirSync(join(out, '.claude-plugin'), { recursive: true })
  mkdirSync(join(plugin, '.claude-plugin'), { recursive: true })
  mkdirSync(join(plugin, 'server', 'views'), { recursive: true })
  cpSync(join(dist, 'server.js'), join(plugin, 'server', 'server.js'))
  for (const file of readdirSync(join(dist, 'views')).filter((name) => name.endsWith('.html'))) {
    cpSync(join(dist, 'views', file), join(plugin, 'server', 'views', file))
  }
  writeJson(
    join(out, '.claude-plugin', 'marketplace.json'),
    marketplaceManifest({ manifest, version })
  )
  writeJson(join(plugin, '.claude-plugin', 'plugin.json'), pluginManifest({ manifest, version }))
  mkdirSync(join(plugin, 'commands'), { recursive: true })
  writeFileSync(join(plugin, 'commands', 'worker.md'), WORKER_COMMAND)
  return { marketplace: out, plugin }
}
