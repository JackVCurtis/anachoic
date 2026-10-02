import type { OutputFormat } from '../types'
import { card, fillTemplate, outputFormat, taskEntry, yourTurn } from './strings'

/** The formats in the order the Output field lists them, after "None". */
export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  'pull_request',
  'ticket',
  'document',
  'link',
]

/** The longest artifact link the tools take, as shared/output_format.ts sets it. */
export const ARTIFACT_URL_MAX = 2000

/** The choices of the Output field. "None" has the empty value. */
export const OUTPUT_OPTIONS: ReadonlyArray<{ value: OutputFormat | ''; label: string }> = [
  { value: '', label: taskEntry.outputNone },
  ...OUTPUT_FORMATS.map((format) => ({ value: format, label: outputFormat.shown[format] })),
]

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value)
}

/**
 * Whether the text is an absolute http: or https: URL the tools take. The
 * format is not checked against the host.
 */
export function isWebAddress(text: string): boolean {
  if (text.length === 0 || text.length > ARTIFACT_URL_MAX) {
    return false
  }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

/**
 * Why Mark done waits for the link typed so far, or null when it is a web
 * address: "Needs a pull request link" while it is empty, and "That is not a
 * web address" once something else is typed. Spaces alone count as empty.
 */
export function artifactUrlProblem(format: OutputFormat, typed: string): string | null {
  const text = typed.trim()
  if (text === '') {
    return fillTemplate(yourTurn.needs, { needed: outputFormat.needed[format] })
  }
  return isWebAddress(text) ? null : yourTurn.notWebAddress
}

/** Ends the label of an artifact link. */
export const ARTIFACT_ARROW = '↗'

/**
 * The visible label of an artifact link, "Pull request · step 2", without
 * its arrow, which is drawn apart and hidden from assistive technology.
 */
export function artifactLinkLabel(format: OutputFormat, stepNumber: number): string {
  return fillTemplate(card.artifactLink, {
    format: outputFormat.shown[format],
    n: stepNumber,
  })
    .replace(ARTIFACT_ARROW, '')
    .trim()
}
