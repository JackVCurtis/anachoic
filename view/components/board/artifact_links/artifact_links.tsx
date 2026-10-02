import type { MouseEvent } from 'react'
import { ARTIFACT_ARROW, artifactLinkLabel } from '../../helpers/output_format'
import { joinClasses } from '../../helpers/join_classes'
import { assistive, card } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardArtifact } from '../board_data'
import styles from './artifact_links.module.css'

export interface ArtifactLinksProps {
  artifacts: readonly BoardArtifact[]
  /** Asks the host to open the address, since the view cannot navigate. */
  onOpenLink: (url: string) => void
  /** Placement only. */
  className?: string
}

/**
 * One line of a task's artifact links, "Pull request · step 2 ↗", each drawn
 * as a small button. The label is the format and the step only, so a long
 * address never widens the card; the address is in the title. A press asks
 * the host to open it, and the frame never navigates. Nothing is drawn for a
 * task with none.
 */
export function ArtifactLinks({ artifacts, onOpenLink, className }: ArtifactLinksProps) {
  if (artifacts.length === 0) {
    return null
  }

  function open(event: MouseEvent<HTMLAnchorElement>, url: string) {
    event.preventDefault()
    if (event.button === 0) {
      onOpenLink(url)
    }
  }

  return (
    <ul aria-label={card.artifactLinks} className={joinClasses(styles.links, className)}>
      {artifacts.map((artifact) => (
        <li key={`${artifact.stepNumber}:${artifact.url}`} className={styles.item}>
          <a
            href={artifact.url}
            title={artifact.url}
            onClick={(event) => open(event, artifact.url)}
            onAuxClick={(event) => event.preventDefault()}
            className={joinClasses('text-control', styles.link)}
          >
            {artifactLinkLabel(artifact.format, artifact.stepNumber)}
            <span aria-hidden="true">{` ${ARTIFACT_ARROW}`}</span>
            <VisuallyHidden>{` ${assistive.opensInBrowser}`}</VisuallyHidden>
          </a>
        </li>
      ))}
    </ul>
  )
}
