import type { OutputFormat } from '../types'
import { card, fillTemplate, outputFormat, taskEntry, working, yourTurn } from './strings'

/** The formats in the order the Output field lists them, after "None". */
export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  'pull_request',
  'ticket',
  'document',
  'link',
]

/** The choices of the Output field. "None" has the empty value. */
export const OUTPUT_OPTIONS: ReadonlyArray<{ value: OutputFormat | ''; label: string }> = [
  { value: '', label: taskEntry.outputNone },
  ...OUTPUT_FORMATS.map((format) => ({ value: format, label: outputFormat.shown[format] })),
]

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value)
}

/** Ends the label of an artifact link. */
export const ARTIFACT_ARROW = '↗'

function withoutArrow(label: string): string {
  return label.replace(ARTIFACT_ARROW, '').trim()
}

/**
 * The visible label of an artifact link, "Pull request · step 2", without
 * its arrow, which is drawn apart and hidden from assistive technology.
 */
export function artifactLinkLabel(format: OutputFormat, stepNumber: number): string {
  return withoutArrow(
    fillTemplate(card.artifactLink, { format: outputFormat.shown[format], n: stepNumber })
  )
}

/**
 * The visible label of the link a user step is handed, "Pull request from
 * step 1", without its arrow.
 */
export function inputLinkLabel(format: OutputFormat, stepNumber: number): string {
  return withoutArrow(
    fillTemplate(yourTurn.input, { format: outputFormat.shown[format], n: stepNumber })
  )
}

/**
 * What a running agent step will produce: "Produces a pull request".
 */
export function producesLine(format: OutputFormat): string {
  return fillTemplate(working.produces, { format: outputFormat.shown[format].toLowerCase() })
}
