// Copied from anachoic inertia/components/helpers/words.ts at fd99e0d
/**
 * A middle dot, U+00B7, with a space each side.
 */
const FACT_SEPARATOR = ' · '

/**
 * The count followed by the noun in the form that agrees with it:
 * `plural(1, 'task')` gives "1 task", `plural(0, 'step')` gives "0 steps".
 * A noun whose plural is not made by adding "s" passes its plural.
 */
export function plural(count: number, singular: string, irregularPlural?: string): string {
  const noun = count === 1 ? singular : (irregularPlural ?? `${singular}s`)
  return `${count} ${noun}`
}

/**
 * A step number as two digits, zero padded: 1 gives "01", 11 gives "11".
 */
export function padStep(step: number): string {
  return String(step).padStart(2, '0')
}

/**
 * The facts joined by a middle dot with a space each side. Empty strings are
 * dropped, so a fact can be left out by passing "".
 */
export function joinFacts(facts: readonly string[]): string {
  return facts.filter((fact) => fact !== '').join(FACT_SEPARATOR)
}

/**
 * The facts of a line joined by `joinFacts`, one by one, for a `MetaLine`.
 */
export function splitFacts(line: string): string[] {
  return line === '' ? [] : line.split(FACT_SEPARATOR)
}
