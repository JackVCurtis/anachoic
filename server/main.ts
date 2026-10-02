import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import type { SessionKind } from '../domain/types.js'
import { closeDatabase, openDatabase } from '../store/database.js'
import { startHeartbeat } from '../store/heartbeat.js'
import {
  homeFromUserDatabase,
  prepareDataDirectory,
  resolveDataDirectory,
} from './data_directory.js'
import { createCallers, type Callers } from './callers.js'
import { describeTools, kindOfOpening, serveByClient } from './client_texts.js'
import { describeClient, hostVariableNames, kindOfClient } from './identity.js'
import { INSTRUCTIONS } from './instructions.js'
import { createLifecycle } from './lifecycle.js'
import { readInput, sessionEnded } from './session_ended.js'
import { createLogger, describeError } from './logger.js'
import { registerPrompts } from './prompts.js'
import { registerBoardTools } from './tools/board.js'
import type { ToolContext } from './tools/context.js'
import { registerHistoryTools } from './tools/history.js'
import { registerJoinBoard } from './tools/join_board.js'
import { registerLeaveBoard } from './tools/leave_board.js'
import { registerModelTools } from './tools/model.js'
import { registerTaskTools } from './tools/task.js'
import { registerViewActions } from './tools/view_actions.js'
import { registerWaitForAnswer } from './tools/wait_for_answer.js'
import { registerWaitForWork } from './tools/wait_for_work.js'
import { VERSION } from './version.js'
import { registerViews, viewUris } from './views.js'
import { waitTimings } from './wait_timings.js'

const VIEWS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'views')
const HTTP_HOST = '127.0.0.1'
const DEFAULT_HTTP_PORT = 3001

/**
 * What every connection's server shares with the others in this process.
 */
type Shared = Omit<ToolContext, 'client'>

/**
 * A server for one connection from the given kind of session, sending that
 * kind's instructions and tool descriptions.
 */
function createServer(shared: Shared, kind: SessionKind) {
  const { logger } = shared
  const server = new McpServer(
    { name: 'anachoic', version: VERSION },
    { instructions: INSTRUCTIONS[kind] }
  )
  const context: ToolContext = {
    ...shared,
    client: () =>
      describeClient(server.server.getClientVersion(), server.server.getClientCapabilities()),
  }
  registerViews(server, shared.views, VIEWS_DIRECTORY, logger)
  describeTools(kind, {
    ...registerBoardTools(server, context),
    ...registerTaskTools(server, context),
    ...registerHistoryTools(server, context),
    join_board: registerJoinBoard(server, context),
    ...registerModelTools(server, context),
    wait_for_answer: registerWaitForAnswer(server, context),
    wait_for_work: registerWaitForWork(server, context),
    leave_board: registerLeaveBoard(server, context),
  })
  registerViewActions(server, context)
  registerPrompts(server)
  server.server.oninitialized = () => {
    const client = context.client()
    // Names only, never values: they show what each host passes to the server.
    logger.log('initialized', {
      client: { name: client?.name, version: client?.version, drawsViews: client?.drawsViews },
      kind: kindOfClient(client),
      environment: hostVariableNames(process.env),
    })
  }
  return server
}

async function serveStdio(shared: Shared, lifecycle: ReturnType<typeof createLifecycle>) {
  // The stdio transport closes itself when stdin ends.
  const connection = await serveByClient(
    new StdioServerTransport(),
    (kind) => createServer(shared, kind),
    () => void lifecycle.stop('stdin closed')
  )
  lifecycle.onStop(() => connection.close())
}

async function serveHttp(shared: Shared, lifecycle: ReturnType<typeof createLifecycle>) {
  const { logger } = shared
  const { createMcpExpressApp } = await import('@modelcontextprotocol/express')
  const { NodeStreamableHTTPServerTransport } = await import('@modelcontextprotocol/node')
  const { default: cors } = await import('cors')

  const app = createMcpExpressApp()
  app.use(cors())
  app.all('/mcp', async (request, response) => {
    const server = createServer(shared, kindOfOpening(request.body))
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

if (process.argv.includes('--session-ended')) {
  // A SessionEnd hook: no MCP and no server, and always exit 0.
  try {
    sessionEnded({
      input: await readInput(process.stdin),
      env: process.env,
      platform: process.platform,
      userHome: homeFromUserDatabase,
    })
  } catch {
    // sessionEnded logs its own failures; nothing may reach the hook's exit code.
  }
  process.exit(0)
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
const shared: Shared = {
  logger,
  database,
  callers,
  now: () => new Date().toISOString(),
  wait: waitTimings(process.env),
  views: viewUris(VIEWS_DIRECTORY),
}

if (transport === 'http') {
  await serveHttp(shared, lifecycle)
} else {
  await serveStdio(shared, lifecycle)
}
