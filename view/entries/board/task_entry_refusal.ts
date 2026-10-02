import type { TaskEntryField } from '../../components/helpers/task_entry'

/*
 * An invalid refusal names its field first, as domain/validate.ts writes it:
 * "title must be …", "steps must be …", "steps[1].title must be …".
 */
const FIELD_SENTENCE = /^(title|steps)(?:\[(\d+)\]\.(title|detail|owner))? must /

/**
 * The task entry field an add_task refusal is about, or null when it is about
 * the action as a whole.
 */
export function taskEntryFieldOf(sentence: string): TaskEntryField | null {
  const match = FIELD_SENTENCE.exec(sentence)
  if (!match) {
    return null
  }
  const [, name, index, part] = match
  if (name === 'title') {
    return { kind: 'title' }
  }
  if (part === 'title' || part === 'detail') {
    return { kind: part === 'title' ? 'step-title' : 'step-detail', index: Number(index) }
  }
  return { kind: 'steps' }
}
