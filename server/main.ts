import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { closeDatabase, openDatabase } from '../store/database.js'
import { startHeartbeat } from '../store/heartbeat.js'
import {
  homeFromUserDatabase,
  prepareDataDirectory,
  resolveDataDirectory,
} from './data_directory.js'
import { createCallers, type Callers } from './callers.js'
import { chooseTextsByClient } from './client_texts.js'
import { hostVariableNames, kindOfClient } from './identity.js'
import { INSTRUCTIONS } from './instructions.js'
import { createLifecycle } from './lifecycle.js'
import { createLogger, describeError } from './logger.js'
import { registerBoardTools } from './tools/board.js'
import type { ToolContext } from './tools/context.js'
import { registerJoinBoard } from './tools/join_board.js'
import { registerModelTools } from './tools/model.js'
import { VERSION } from './version.js'
import { registerViews } from './views.js'

const VIEWS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'views')
const HTTP_HOST = '127.0.0.1'
const DEFAULT_HTTP_PORT = 3001

/**
 * What every connection's server shares with the others in this process.
 */
type Shared = Omit<ToolContext, 'client'>

function createServer(shared: Shared) {
  const { logger } = shared
  const server = new McpServer(
    { name: 'anachoic', version: VERSION },
    { instructions: INSTRUCTIONS.worker }
  )
  const context: ToolContext = { ...shared, client: () => server.server.getClientVersion() }
  registerViews(server, VIEWS_DIRECTORY, logger)
  chooseTextsByClient(server, {
    ...registerBoardTools(server, context),
    join_board: registerJoinBoard(server, context),
    ...registerModelTools(server, context),
  })
  server.server.oninitialized = () => {
    const client = context.client()
    // Names only, never values: they show what each host passes to the server.
    logger.log('initialized', {
      client: { name: client?.name, version: client?.version },
      kind: kindOfClient(client),
      environment: hostVariableNames(process.env),
    })
  }
  return server
}

async function serveStdio(shared: Shared, lifecycle: ReturnType<typeof createLifecycle>) {
  const { logger } = shared
  const server = createServer(shared)
  lifecycle.onStop(() => server.close())
  // The stdio transport closes itself when stdin ends.
  server.server.onclose = () => void lifecycle.stop('stdin closed')
  await server.connect(new StdioServerTransport())
}

async function serveHttp(shared: Shared, lifecycle: ReturnType<typeof createLifecycle>) {
  const { logger } = shared
  const { createMcpExpressApp } = await import('@modelcontextprotocol/express')
  const { NodeStreamableHTTPServerTransport } = await import('@modelcontextprotocol/node')
  const { default: cors } = await import('cors')

  const app = createMcpExpressApp()
  app.use(cors())
  app.all('/mcp', async (request, response) => {
    const server = createServer(shared)
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

const databaseFile = join(directory, 'board.sqlite')
let database: ReturnType<typeof openDatabase>
try {
  database = openDatabase(databaseFile)
} catch (error) {
  logger.log('database_failed', { file: databaseFile, ...describeError(error) })
  process.stderr.write(`Anachoic MCP cannot start: ${(error as Error).message}\n`)
  process.exit(1)
}
const heartbeat = startHeartbeat(database, {
  onError: (error) => logger.log('heartbeat_failed', describeError(error)),
})
lifecycle.onStop(() => {
  heartbeat.stop()
  closeDatabase(database)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void lifecycle.stop(signal))
}

const callers: Callers = createCallers({
  database,
  heartbeat,
  env: {
    CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  },
  logger,
})
const shared: Shared = { logger, database, callers, now: () => new Date().toISOString() }

if (transport === 'http') {
  await serveHttp(shared, lifecycle)
} else {
  await serveStdio(shared, lifecycle)
}
