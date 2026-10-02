import type { ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { artifactLinkLabel, inputLinkLabel, producesLine } from '../../helpers/output_format'
import { stepStatusLabel, timelineAppearance } from '../../helpers/steps'
import { fillTemplate, taskView, yourTurn } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { padStep } from '../../helpers/words'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { Disclosure } from '../../patterns/disclosure/disclosure'
import { OwnerChip } from '../../patterns/owner_chip/owner_chip'
import { Frame } from '../../primitives/frame/frame'
import { StepLink } from '../step_link/step_link'
import type { TimelineStepData } from '../task_data'
import styles from './timeline_step.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

export interface TimelineStepProps {
  step: TimelineStepData
  /** The step the chain is at. */
  isCurrent: boolean
  open: boolean
  /** The step's header was pressed. The chain decides what opens. */
  onToggle: () => void
  /** Asks the host to open a link, since the view cannot navigate. */
  onOpenLink: (url: string) => void
}

/**
 * "Blocked · 14m" for a blocked step, else the status label of the step.
 */
function statusLabel(step: TimelineStepData, now: string): string {
  if (step.status === 'waiting' && step.blocked) {
    return fillTemplate(taskView.stepBlocked, { time: formatWaited(step.blocked.since, now) })
  }
  return stepStatusLabel(
    {
      status: step.status,
      durationSeconds: step.durationSeconds,
      startedAt: step.runningSince,
      earlierSeconds: step.elapsedSeconds,
      waitingSince: step.waitingSince,
    },
    now
  )
}

/**
 * One step of the chain: a marker on the rail, and a block whose header
 * opens a panel with everything recorded about the step. Only the header is
 * the toggle; a press inside the panel does nothing to the step.
 */
export function TimelineStep({ step, isCurrent, open, onToggle, onOpenLink }: TimelineStepProps) {
  const now = useNow(step.status === 'running' ? LABEL_TICK.elapsed : LABEL_TICK.waited)
  const appearance = timelineAppearance(step.status, step.owner, isCurrent)
  const inverted = appearance === 'current-waiting'
  const quiet =
    appearance === 'current-agent-pending' ||
    appearance === 'current-you-pending' ||
    appearance === 'pending'

  return (
    <li className={styles.step} data-appearance={appearance}>
      <div className={styles.rail} aria-hidden="true">
        <span className={styles.marker} />
        <span className={styles.line} />
      </div>
      <div className={joinClasses(styles.column, quiet && styles.quiet)}>
        <Frame
          tone={inverted ? 'inverse' : 'light'}
          emphasis={quiet ? 'muted' : 'default'}
          className={styles.block}
        >
          <Disclosure
            open={open}
            onToggle={onToggle}
            headingLevel={4}
            headingClassName={styles.heading}
            toggleClassName={styles.toggle}
            panelClassName={styles.panel}
            toggle={
              <>
                <span className={styles.header}>
                  <span className={joinClasses('text-mono-xs', styles.number)}>
                    {padStep(step.number)}
                  </span>
                  <OwnerChip
                    owner={step.owner}
                    size="md"
                    form="named"
                    sessionName={step.sessionName}
                  />
                  <span className={joinClasses('text-status', 'text-tabular', styles.status)}>
                    <SymbolText>{statusLabel(step, now)}</SymbolText>
                  </span>
                </span>
                <span className={joinClasses('text-title-2', styles.title)}>{step.title}</span>
              </>
            }
          >
            <StepDetail step={step} onOpenLink={onOpenLink} />
          </Disclosure>
        </Frame>
      </div>
    </li>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={joinClasses('text-label', styles.label)}>{label}</dt>
      <dd className={joinClasses('text-body-sm', styles.value)}>{children}</dd>
    </div>
  )
}

/**
 * Everything recorded about a step, each part only when the step has it:
 * who claimed it, its input, its detail, why it is blocked, the question and
 * answer, the latest note, the summary, its output and its links.
 */
function StepDetail({
  step,
  onOpenLink,
}: {
  step: TimelineStepData
  onOpenLink: (url: string) => void
}) {
  const isAgent = step.owner === 'agent'
  const links = step.links ?? []
  const unclaimed = isAgent && !step.sessionName && step.status === 'pending'

  return (
    <dl className={styles.facts}>
      {isAgent && step.sessionName && <Fact label={taskView.claimedBy}>{step.sessionName}</Fact>}
      {unclaimed && (
        <Fact label={taskView.claimedBy}>
          <span className={styles.dim}>{taskView.unclaimed}</span>
        </Fact>
      )}
      {step.owner === 'you' && step.input && (
        <Fact label={taskView.input}>
          <StepLink
            url={step.input.url}
            label={inputLinkLabel(step.input.format, step.input.stepNumber)}
            onOpenLink={onOpenLink}
          />
        </Fact>
      )}
      {step.detail && <Fact label={taskView.detail}>{step.detail}</Fact>}
      {step.blocked && (
        <Fact label={taskView.blocked}>
          <span className={styles.text}>{step.blocked.reason}</span>
          <span className={joinClasses('text-hint', styles.unblock)}>
            {step.sessionName
              ? fillTemplate(yourTurn.unblockIn, { session: step.sessionName })
              : yourTurn.unblockInUnnamed}
          </span>
        </Fact>
      )}
      {step.question && (
        <Fact label={taskView.asks}>
          <span className={styles.text}>{step.question}</span>
        </Fact>
      )}
      {step.answer && (
        <Fact label={taskView.answer}>
          <span className={styles.text}>{step.answer}</span>
        </Fact>
      )}
      {step.note && <Fact label={taskView.latestNote}>{step.note}</Fact>}
      {step.summary && (
        <Fact label={taskView.summary}>
          <span className={styles.text}>{step.summary}</span>
        </Fact>
      )}
      {step.outputFormat && (
        <Fact label={taskView.output}>
          {step.artifactUrl ? (
            <StepLink
              url={step.artifactUrl}
              label={artifactLinkLabel(step.outputFormat, step.number)}
              onOpenLink={onOpenLink}
            />
          ) : (
            producesLine(step.outputFormat)
          )}
        </Fact>
      )}
      {links.length > 0 && (
        <Fact label={taskView.links}>
          <ul className={styles.links}>
            {links.map((link, index) => (
              // A session may record the same address twice, so its place is part of its key.
              <li key={`${index}:${link.url}`}>
                <StepLink url={link.url} label={link.label} onOpenLink={onOpenLink} />
              </li>
            ))}
          </ul>
        </Fact>
      )}
    </dl>
  )
}
