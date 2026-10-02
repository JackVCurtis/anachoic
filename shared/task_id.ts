// Copied from anachoic shared/task_id.ts at fd99e0d
/**
 * A task is numbered in the database and named T-012 everywhere else: in tool
 * inputs and results, on the board and in the event log. These functions are
 * the only way between the two forms.
 */
export class InvalidTaskIdError extends Error {
  constructor(readonly value: string) {
    super(`“${value}” is not a task id. A task id looks like T-118.`)
    this.name = 'InvalidTaskIdError'
  }
}

const DISPLAY_ID = /^T-(\d+)$/

/**
 * The display form: T, a hyphen, and the number padded with zeros to three digits.
 */
export function formatTaskId(id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new RangeError(`A task number must be a positive integer, not ${id}`)
  }
  return `T-${String(id).padStart(3, '0')}`
}

/**
 * The number a display id names. Anything that is not T, a hyphen and a positive whole number is
 * refused with an InvalidTaskIdError.
 */
export function parseTaskId(value: string): number {
  const match = DISPLAY_ID.exec(value)
  const id = match ? Number(match[1]) : Number.NaN
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new InvalidTaskIdError(value)
  }
  return id
}

const DIGITS = /^\d+$/

/**
 * The number a tool's `task` input names. It accepts a display id such as
 * T-012, a positive whole number, or a string of digits, and refuses anything
 * else with an InvalidTaskIdError.
 */
export function toTaskNumber(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new InvalidTaskIdError(String(value))
    }
    return value
  }
  if (DIGITS.test(value)) {
    const id = Number(value)
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new InvalidTaskIdError(value)
    }
    return id
  }
  return parseTaskId(value)
}
