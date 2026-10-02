import type { McpServer } from '@modelcontextprotocol/server'
import { PROMPTS } from '../shared/prompts.mjs'

/**
 * Registers each prompt of shared/prompts.mjs. None takes arguments, and
 * each returns its text as one user message.
 */
export function registerPrompts(server: McpServer) {
  for (const { name, title, text } of PROMPTS) {
    server.registerPrompt(name, { title, description: title }, () => ({
      messages: [{ role: 'user', content: { type: 'text', text } }],
    }))
  }
}
