import type { MouseEvent } from 'react'
import { ARTIFACT_ARROW, artifactLinkLabel } from '../../helpers/output_format'
import { joinClasses } from '../../helpers/join_classes'
import { assistive, card } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardArtifact } from '../board_data'
import styles from './artifact_links.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

export interface ArtifactLinkProps {
  url: string
  /** The visible label, without the arrow. */
  label: string
  /** Asks the host to open the address, since the view cannot navigate. */
  onOpenLink: (url: string) => void
  /** Placement only. */
  className?: string
}

/**
 * One artifact link drawn as a small button, in the tone of the card it sits
 * on. The label never shows the address, so a long one never widens the card;
 * the address is in the title. A press asks the host to open it, and the
 * frame never navigates.
 */
export function ArtifactLink({ url, label, onOpenLink, className }: ArtifactLinkProps) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    if (event.button === 0) {
      onOpenLink(url)
    }
  }

  return (
    <a
      href={url}
      title={url}
      onClick={open}
      onAuxClick={(event) => event.preventDefault()}
      className={joinClasses('text-control', styles.link, className)}
    >
      <SymbolText>{label}</SymbolText>
      <span aria-hidden="true">{` ${ARTIFACT_ARROW}`}</span>
      <VisuallyHidden>{` ${assistive.opensInBrowser}`}</VisuallyHidden>
    </a>
  )
}

export interface ArtifactLinksProps {
  artifacts: readonly BoardArtifact[]
  /** Asks the host to open the address, since the view cannot navigate. */
  onOpenLink: (url: string) => void
  /** Placement only. */
  className?: string
}

/**
 * One line of a task's artifact links, "Pull request · step 2 ↗". Nothing is
 * drawn for a task with none.
 */
export function ArtifactLinks({ artifacts, onOpenLink, className }: ArtifactLinksProps) {
  if (artifacts.length === 0) {
    return null
  }

  return (
    <ul aria-label={card.artifactLinks} className={joinClasses(styles.links, className)}>
      {artifacts.map((artifact) => (
        <li key={`${artifact.stepNumber}:${artifact.url}`} className={styles.item}>
          <ArtifactLink
            url={artifact.url}
            label={artifactLinkLabel(artifact.format, artifact.stepNumber)}
            onOpenLink={onOpenLink}
          />
        </li>
      ))}
    </ul>
  )
}
