// Copied from anachoic inertia/components/helpers/announcement.ts at fd99e0d
import { assistive, fillTemplate } from './strings'

/**
 * A board fact worth saying in the view's live region. The list is closed;
 * the board decides when a fact happened. A task arrives in Your turn as one
 * of its two kinds of card: your own step, or an agent's question, asked by a
 * session the props may not name.
 */
export type AnnouncementFact =
  | { kind: 'your-step'; title: string }
  | { kind: 'question'; title: string; sessionName?: string | null }
  | { kind: 'sign-off'; title: string }

/**
 * One sentence for the view's live region, or null for a fact that is not on
 * the list, which is not announced.
 */
export function announcement(fact: AnnouncementFact): string | null {
  switch (fact.kind) {
    case 'your-step':
      return fillTemplate(assistive.waitingOnYou, { title: fact.title })
    case 'question':
      return fact.sessionName
        ? fillTemplate(assistive.sessionAsks, { session: fact.sessionName, title: fact.title })
        : fillTemplate(assistive.questionForYou, { title: fact.title })
    case 'sign-off':
      return fillTemplate(assistive.waitingForSignOff, { title: fact.title })
    default:
      return null
  }
}
