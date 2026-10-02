/**
 * A step's id is its task's number and its own number, as in "12.2". It is
 * stable because a task number is never reused and a step's number never
 * changes.
 */
export class InvalidStepIdError extends Error {
  constructor(readonly value: string) {
    super(`“${value}” is not a step id. A step id looks like 12.2.`)
    this.name = 'InvalidStepIdError'
  }
}

const STEP_ID = /^([1-9]\d*)\.([1-9]\d*)$/

function assertPositive(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`A ${name} must be a positive integer, not ${value}`)
  }
}

export function stepId(taskNumber: number, stepNumber: number): string {
  assertPositive('task number', taskNumber)
  assertPositive('step number', stepNumber)
  return `${taskNumber}.${stepNumber}`
}

export function parseStepId(value: string): { taskNumber: number; stepNumber: number } {
  const match = STEP_ID.exec(value)
  const taskNumber = match ? Number(match[1]) : Number.NaN
  const stepNumber = match ? Number(match[2]) : Number.NaN
  if (!Number.isSafeInteger(taskNumber) || !Number.isSafeInteger(stepNumber)) {
    throw new InvalidStepIdError(value)
  }
  return { taskNumber, stepNumber }
}
