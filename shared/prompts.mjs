/**
 * The MCP prompts the server offers, which clients show as commands, such as
 * /mcp__anachoic__board in Claude Code. Each prompt's text becomes the
 * user's message. The .mcpb manifest declares the same prompts with exactly
 * this text, because desktop compares the served text with the declared
 * text, so scripts/pack.mjs writes the manifest's prompts from this module.
 *
 * @typedef {{ name: string, title: string, text: string }} Prompt
 */

/** @type {readonly Prompt[]} */
export const PROMPTS = Object.freeze([
  { name: 'board', title: 'Show the board', text: 'Show the Anachoic board.' },
  { name: 'history', title: 'Show the history', text: 'Show the Anachoic history.' },
])

/**
 * The prompts as the .mcpb manifest declares them.
 *
 * @returns {Array<{ name: string, description: string, text: string }>}
 */
export function manifestPrompts() {
  return PROMPTS.map(({ name, title, text }) => ({ name, description: title, text }))
}
