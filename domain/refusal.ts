/**
 * A service's refusal: a code for the caller and a sentence for whoever reads
 * it. A refusal changes nothing.
 */
export type RefusalCode =
  | 'not_found'
  | 'not_current'
  | 'wrong_status'
  | 'not_yours'
  | 'nothing_to_claim'
  | 'unanswered'
  | 'signed_off'
  | 'archived'
  | 'invalid'
  | 'busy'

export interface Refusal {
  readonly code: RefusalCode
  readonly sentence: string
}

export function refusal(code: RefusalCode, sentence: string): Refusal {
  return { code, sentence }
}
