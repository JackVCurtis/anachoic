import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MARKETPLACE_NAME = 'anachoic'
export const PLUGIN_NAME = 'anachoic-worker'

/**
 * The data directory as the extension's manifest sets it, with `${HOME}`
 * written for the shell that runs a hook command.
 */
function shellDataDir(manifest) {
  return manifest.server.mcp_config.env.ANACHOIC_DATA_DIR.replaceAll('${HOME}', '$HOME')
}

/**
 * The plugin's manifest: the MCP server and the SessionEnd hook that removes
 * the worker from the board when its session ends, both running the server
 * bundled in the plugin against the extension's data directory. The MCP
 * server is given no ANACHOIC_DATA_DIR: whether Claude Code expands ${HOME}
 * in a plugin server's env is not documented, and the server's own default
 * is the extension's directory. The hook command runs in a shell, which
 * expands $HOME.
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
              command: `ANACHOIC_DATA_DIR="${shellDataDir(manifest)}" node "\${CLAUDE_PLUGIN_ROOT}/server/server.js" --session-ended`,
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
  return { marketplace: out, plugin }
}
