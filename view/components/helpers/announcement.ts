// Copied from anachoic inertia/components/helpers/announcement.ts at fd99e0d
import { assistive, fillTemplate } from './strings'

/**
 * A board fact worth saying in the view's live region. The list is closed;
 * the board decides when a fact happened.
 */
export type AnnouncementFact =
  { kind: 'your-turn'; title: string } | { kind: 'sign-off'; title: string }

/**
 * One sentence for the view's live region, or null for a fact that is not on
 * the list, which is not announced.
 */
export function announcement(fact: AnnouncementFact): string | null {
  switch (fact.kind) {
    case 'your-turn':
      return fillTemplate(assistive.waitingOnYou, { title: fact.title })
    case 'sign-off':
      return fillTemplate(assistive.waitingForSignOff, { title: fact.title })
    default:
      return null
  }
}
