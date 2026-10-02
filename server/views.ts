import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import type { Logger } from './logger.js'

export const VIEW_ENTRIES = ['board', 'task', 'history'] as const

export type ViewEntry = (typeof VIEW_ENTRIES)[number]

export type ViewUris = Record<ViewEntry, string>

/**
 * Each view's ui:// address, carrying the first 12 hex digits of a SHA-256 of
 * its HTML, such as ui://anachoic/board-3f9a0c1e7b2d.html. Claude desktop
 * caches a view's HTML by its address and does not read it again after the
 * extension is reinstalled, so a rebuilt view must arrive under a new
 * address. A view whose file cannot be read keeps the plain address.
 */
export function viewUris(viewsDirectory: string): ViewUris {
  const uri = (entry: ViewEntry) => {
    try {
      const html = readFileSync(join(viewsDirectory, `${entry}.html`))
      const hash = createHash('sha256').update(html).digest('hex').slice(0, 12)
      return `ui://anachoic/${entry}-${hash}.html`
    } catch {
      return `ui://anachoic/${entry}.html`
    }
  }
  return { board: uri('board'), task: uri('task'), history: uri('history') }
}

/**
 * Serves each view as a ui:// resource at its address from viewUris. The HTML
 * is read from the views/ folder beside the server file on every read.
 * Everything is inlined, so no CSP domains are declared.
 */
export function registerViews(
  server: McpServer,
  uris: ViewUris,
  viewsDirectory: string,
  logger: Logger
) {
  for (const entry of VIEW_ENTRIES) {
    const uri = uris[entry]
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
