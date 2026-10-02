import { DEDICATED_SESSION_ID, YOU, type SessionKind } from '../domain/types.js'
import type { Identity } from '../store/sessions.js'

/**
 * What the client said about itself in initialize.
 */
export interface ClientInfo {
  name?: string
  version?: string
}

/**
 * The only environment variables the server reads to learn who it serves.
 */
export interface IdentityEnvironment {
  CLAUDE_CODE_SESSION_ID?: string
  CLAUDE_PROJECT_DIR?: string
}

export const CLAUDE_CODE_CLIENT = 'claude-code'
export const DESKTOP_CHAT_CLIENT = 'claude-ai'

/**
 * How a call's session was found:
 * - client: from the client and the process, as a Claude Code worker or the
 *   dedicated session
 * - session: named by the call's session argument, which must already exist
 * - mint: no usable id, so the server mints one for this process
 */
export type Resolution =
  { source: 'client'; identity: Identity } | { source: 'session'; id: string } | { source: 'mint' }

function usableId(id: string | undefined): id is string {
  return id !== undefined && id.trim() !== '' && id !== YOU && id !== DEDICATED_SESSION_ID
}

/**
 * Who a call comes from, by the rule in 05: never from what the model says,
 * except a session id the server minted and handed back to it.
 */
export function resolveIdentity(
  client: ClientInfo | undefined,
  env: IdentityEnvironment,
  sessionArg?: string
): Resolution {
  if (client?.name === DESKTOP_CHAT_CLIENT) {
    return {
      source: 'client',
      identity: { id: DEDICATED_SESSION_ID, kind: 'dedicated', projectDir: null },
    }
  }
  if (client?.name === CLAUDE_CODE_CLIENT && usableId(env.CLAUDE_CODE_SESSION_ID)) {
    return {
      source: 'client',
      identity: {
        id: env.CLAUDE_CODE_SESSION_ID,
        kind: 'worker',
        projectDir: env.CLAUDE_PROJECT_DIR || null,
      },
    }
  }
  if (sessionArg !== undefined) return { source: 'session', id: sessionArg }
  return { source: 'mint' }
}

/**
 * The kind of session a client's calls belong to, which also decides which
 * instructions it is sent.
 */
export function kindOfClient(client: ClientInfo | undefined): SessionKind {
  return client?.name === DESKTOP_CHAT_CLIENT ? 'dedicated' : 'worker'
}

/**
 * The environment variable names worth recording to learn what a host
 * passes to the server. Only names are kept, never values, and only those
 * that a Claude host or MCP sets.
 */
export function hostVariableNames(env: Record<string, string | undefined>): string[] {
  return Object.keys(env)
    .filter((name) => /^(CLAUDE|ANTHROPIC|MCP)/.test(name))
    .sort()
}
