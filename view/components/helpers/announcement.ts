// Copied from anachoic inertia/components/helpers/announcement.ts at fd99e0d
import { assistive, fillTemplate } from './strings'

/**
 * A board fact worth saying in the view's live region. The list is closed;
 * the board decides when a fact happened. A task arrives in Your turn as one
 * of its three kinds of card: your own step, an agent's question, or a step
 * a worker blocked. A blocked task is named by its display id; the session
 * that asks or blocked is one the props may not name.
 */
export type AnnouncementFact =
  | { kind: 'your-step'; title: string }
  | { kind: 'question'; title: string; sessionName?: string | null }
  | { kind: 'blocked'; displayId: string; sessionName?: string | null }
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
    case 'blocked':
      return fact.sessionName
        ? fillTemplate(assistive.blockedIn, { id: fact.displayId, session: fact.sessionName })
        : fillTemplate(assistive.blockedUnnamed, { id: fact.displayId })
    case 'sign-off':
      return fillTemplate(assistive.waitingForSignOff, { title: fact.title })
    default:
      return null
  }
}
