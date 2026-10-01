// Copied from anachoic inertia/components/helpers/messages.ts at fd99e0d
import { message } from './strings'

export type FlashKind = 'success' | 'error'

/**
 * The word that begins a message from the server: "Done" or "Error".
 */
export function flashWord(kind: FlashKind): string {
  return kind === 'success' ? message.success : message.error
}
