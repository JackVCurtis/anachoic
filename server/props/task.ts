import { currentStep } from '../../domain/chain.js'
import { agentSeconds, canAct, inputOf, isLive, listOf, yourSeconds } from '../../domain/derived.js'
import { isYou, type Actor, type Instant, type Step } from '../../domain/types.js'
import type { Artifact, TaskProps, TaskSession, TaskStep } from '../../shared/props.js'
import type { TaskSnapshot } from '../../store/queries.js'
import { taskRef } from './board.js'

/**
 * Builds the task props from one snapshot: the task, every step in full, its
 * events and its derived times. As with the board, every fact comes from
 * domain/ and the view only formats.
 */
export function taskProps(snapshot: TaskSnapshot, now: Instant): TaskProps {
  const { state, events } = snapshot
  const { task, steps } = state
  const known = new Map(snapshot.sessions.map((session) => [session.id, session]))
  const sessionOf = (id: string): TaskSession => {
    const session = known.get(id)
    return { id, name: session?.name ?? id, live: session ? isLive(session, now) : false }
  }
  const actorOf = (actor: Actor): 'you' | TaskSession => (isYou(actor) ? 'you' : sessionOf(actor))
  const nameOf = (id: string) => known.get(id)?.name ?? id

  const current = currentStep(steps)
  const completedBy = new Map<string, string>()
  for (const event of events) {
    if (event.kind === 'completed' && event.stepId !== null && !isYou(event.sessionId)) {
      completedBy.set(event.stepId, event.sessionId)
    }
  }
  const stepSession = (step: Step): TaskSession | null => {
    if (step.owner !== 'agent') return null
    const id = step.claimedBy ?? (step.status === 'done' ? completedBy.get(step.id) : undefined)
    return id === undefined ? null : sessionOf(id)
  }

  const numberOf = new Map(steps.map((step) => [step.id, step.number]))
  const can = canAct(state)

  return {
    revision: snapshot.revision,
    now,
    task: {
      ...taskRef(task, nameOf),
      status: task.status,
      list: listOf(state),
      queuePosition: task.queuePosition,
      createdBy: actorOf(task.createdBy),
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      signedOffAt: task.signedOffAt,
      archivedAt: task.archivedAt,
      resumeWith:
        task.resumeWith === null ? null : { id: task.resumeWith, name: nameOf(task.resumeWith) },
    },
    steps: steps.map((step): TaskStep => ({
      id: step.id,
      number: step.number,
      owner: step.owner,
      title: step.title,
      detail: step.detail,
      status: step.status,
      origin: step.origin,
      current: step.id === current.id,
      session: stepSession(step),
      form: step.form,
      answer: step.answer,
      note: step.note,
      summary: step.summary,
      links: step.links.map(({ label, url }) => ({ label, url })),
      outputFormat: step.outputFormat,
      artifactUrl: step.artifactUrl,
      input: inputOf(steps, step),
      blocked:
        step.blockedReason === null
          ? null
          : { reason: step.blockedReason, since: step.blockedAt ?? now },
      startedAt: step.startedAt,
      runningSince: step.runningSince,
      waitingSince: step.waitingSince,
      finishedAt: step.finishedAt,
      elapsedSeconds: step.elapsedSeconds,
      waitedSeconds: step.waitedSeconds,
    })),
    agentSeconds: agentSeconds(steps),
    yourSeconds: yourSeconds(steps),
    artifacts: steps.flatMap((step): Artifact[] =>
      step.status === 'done' && step.outputFormat !== null && step.artifactUrl !== null
        ? [{ stepNumber: step.number, format: step.outputFormat, url: step.artifactUrl }]
        : []
    ),
    events: events.map((event) => ({
      id: event.id,
      at: event.at,
      kind: event.kind,
      stepNumber: event.stepId === null ? null : (numberOf.get(event.stepId) ?? null),
      by: actorOf(event.sessionId),
      detail: event.detail,
    })),
    canAct: { archive: can.archive, park: can.park },
  }
}
