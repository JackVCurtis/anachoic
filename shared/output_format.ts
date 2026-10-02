/**
 * The artifact a step you own may require when you mark it done, and the
 * check its URL must pass. Shared by the domain, the tools and the view.
 */

export const OUTPUT_FORMATS = ['pull_request', 'ticket', 'document', 'link'] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export interface OutputFormatWords {
  /** How a card or a text names the format: "Pull request". */
  shown: string
  /** The label of the URL field when you mark the step done: "Pull request link". */
  field: string
  /** What the step needs, as a sentence ends: "a pull request link". */
  needed: string
}

export const OUTPUT_FORMAT_WORDS: Record<OutputFormat, OutputFormatWords> = {
  pull_request: {
    shown: 'Pull request',
    field: 'Pull request link',
    needed: 'a pull request link',
  },
  ticket: { shown: 'Ticket', field: 'Ticket link', needed: 'a ticket link' },
  document: { shown: 'Document', field: 'Document link', needed: 'a document link' },
  link: { shown: 'Link', field: 'Link', needed: 'a link' },
}

export const ARTIFACT_URL_MAX = 2000

export function isOutputFormat(value: unknown): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly unknown[]).includes(value)
}

/**
 * An absolute http: or https: URL of at most ARTIFACT_URL_MAX characters.
 * The format is not checked against the host.
 */
export function isWebAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > ARTIFACT_URL_MAX) {
    return false
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}
