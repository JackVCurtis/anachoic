import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import {
  homeFromUserDatabase,
  prepareDataDirectory,
  resolveDataDirectory,
} from './data_directory.js'
import { createLifecycle } from './lifecycle.js'
import { createLogger, describeError, type Logger } from './logger.js'
import { registerBoardTools } from './tools/board.js'
import { VERSION } from './version.js'
import { registerViews } from './views.js'

const VIEWS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'views')
const HTTP_HOST = '127.0.0.1'
const DEFAULT_HTTP_PORT = 3001

function createServer(logger: Logger) {
  const server = new McpServer({ name: 'anachoic', version: VERSION })
  registerViews(server, VIEWS_DIRECTORY, logger)
  registerBoardTools(server, logger)
  server.server.oninitialized = () => {
    const client = server.server.getClientVersion()
    logger.log('initialized', { client: { name: client?.name, version: client?.version } })
  }
  return server
}

async function serveStdio(logger: Logger, lifecycle: ReturnType<typeof createLifecycle>) {
  const server = createServer(logger)
  lifecycle.onStop(() => server.close())
  // The stdio transport closes itself when stdin ends.
  server.server.onclose = () => void lifecycle.stop('stdin closed')
  await server.connect(new StdioServerTransport())
}

async function serveHttp(logger: Logger, lifecycle: ReturnType<typeof createLifecycle>) {
  const { createMcpExpressApp } = await import('@modelcontextprotocol/express')
  const { NodeStreamableHTTPServerTransport } = await import('@modelcontextprotocol/node')
  const { default: cors } = await import('cors')

  const app = createMcpExpressApp()
  app.use(cors())
  app.all('/mcp', async (request, response) => {
    const server = createServer(logger)
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    response.on('close', () => {
      transport.close().catch(() => {})
      server.close().catch(() => {})
    })
    await server.connect(transport)
    await transport.handleRequest(request, response, request.body)
  })

  const port = Number(process.env.PORT ?? DEFAULT_HTTP_PORT)
  const listener = app.listen(port, HTTP_HOST, () => {
    logger.log('http', { url: `http://${HTTP_HOST}:${port}/mcp` })
  })
  listener.on('error', (error) => {
    logger.log('http_failed', describeError(error))
    void lifecycle.stop('http failed', 1)
  })
  lifecycle.onStop(
    () =>
      new Promise<void>((resolve) => {
        listener.close(() => resolve())
        listener.closeAllConnections()
      })
  )
}

const resolution = resolveDataDirectory({
  env: process.env,
  platform: process.platform,
  userHome: homeFromUserDatabase,
})
if (!resolution.ok) {
  process.stderr.write(`Anachoic MCP cannot start: ${resolution.reason}\n`)
  process.exit(1)
}

const { directory, logs } = prepareDataDirectory(resolution.directory)
const logger = createLogger({ logsDirectory: logs })
const transport = process.argv.includes('--http') ? 'http' : 'stdio'
const lifecycle = createLifecycle(logger)

logger.log('start', {
  node: process.version,
  version: VERSION,
  transport,
  dataDirectory: directory,
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void lifecycle.stop(signal))
}

if (transport === 'http') {
  await serveHttp(logger, lifecycle)
} else {
  await serveStdio(logger, lifecycle)
}
