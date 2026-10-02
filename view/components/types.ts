// Copied from anachoic inertia/components/types.ts at fd99e0d
/**
 * The small unions many components share. Each component declares the rest
 * of its props in its own terms.
 */

export type Owner = 'agent' | 'you'

export type StepStatus = 'pending' | 'running' | 'waiting' | 'done'

export type TaskStatus = 'backlog' | 'queue' | 'active' | 'done'

export type Tone = 'light' | 'inverse'

/** What an agent step hands on when it is done: a link of this kind. */
export type OutputFormat = 'pull_request' | 'ticket' | 'document' | 'link'
