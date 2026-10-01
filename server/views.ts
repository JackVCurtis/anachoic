import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import type { Logger } from './logger.js'

export const VIEWS = {
  board: 'ui://anachoic/board.html',
  task: 'ui://anachoic/task.html',
} as const

/**
 * Serves each view as a ui:// resource. The HTML is read from the views/
 * folder beside the server file on every read, so a rebuilt view shows
 * without restarting the server. Everything is inlined, so no CSP domains are
 * declared.
 */
export function registerViews(server: McpServer, viewsDirectory: string, logger: Logger) {
  for (const [entry, uri] of Object.entries(VIEWS)) {
    registerAppResource(
      server,
      `${entry} view`,
      uri,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        logger.log('resource', { uri })
        return {
          contents: [
            {
              uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: await readFile(join(viewsDirectory, `${entry}.html`), 'utf8'),
              _meta: { ui: { prefersBorder: true } },
            },
          ],
        }
      }
    )
  }
}
