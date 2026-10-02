import { LIMITS, type LimitedField } from '../shared/limits.js'
import { invalid, type Refusal } from './refusal.js'
import type { Link, StepInput } from './types.js'

/**
 * Input checks against the limits in shared/limits.ts. Each returns the
 * invalid refusal, naming the field and its limit, or null.
 */

function count(value: number) {
  return value.toLocaleString('en-US')
}

function limitOf(field: LimitedField, unit: string) {
  const { min, max } = LIMITS[field]
  return min === 0 ? `at most ${count(max)} ${unit}` : `${count(min)} to ${count(max)} ${unit}`
}

export function checkText(
  field: LimitedField,
  value: unknown,
  name: string = field
): Refusal | null {
  const { min, max } = LIMITS[field]
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    return invalid(`${name} must be ${limitOf(field, 'characters')}`)
  }
  return null
}

export function checkOptionalText(
  field: LimitedField,
  value: unknown,
  name: string = field
): Refusal | null {
  return value === undefined || value === null ? null : checkText(field, value, name)
}

export function checkLinks(links: unknown): Refusal | null {
  if (links === undefined || links === null) return null
  if (!Array.isArray(links) || links.length > LIMITS.links.max) {
    return invalid(`links must be ${limitOf('links', 'links')}`)
  }
  for (const [index, link] of (links as Link[]).entries()) {
    const ok =
      typeof link === 'object' &&
      link !== null &&
      typeof link.label === 'string' &&
      link.label.trim() !== '' &&
      typeof link.url === 'string' &&
      link.url.trim() !== ''
    if (!ok) return invalid(`links[${index}] must have a label and a url`)
  }
  return null
}

export function checkSteps(steps: unknown): Refusal | null {
  if (!Array.isArray(steps) || steps.length < LIMITS.steps.min || steps.length > LIMITS.steps.max) {
    return invalid(`steps must be ${limitOf('steps', 'steps')}`)
  }
  for (const [index, step] of (steps as StepInput[]).entries()) {
    if (
      typeof step !== 'object' ||
      step === null ||
      (step.owner !== 'agent' && step.owner !== 'you')
    ) {
      return invalid(`steps[${index}].owner must be agent or you`)
    }
    const refused =
      checkText('title', step.title, `steps[${index}].title`) ??
      (step.detail === undefined || step.detail === null || step.detail === ''
        ? null
        : checkText('detail', step.detail, `steps[${index}].detail`))
    if (refused) return refused
  }
  return null
}

export function firstRefusal(...checks: Array<Refusal | null>): Refusal | null {
  return checks.find((check) => check !== null) ?? null
}
