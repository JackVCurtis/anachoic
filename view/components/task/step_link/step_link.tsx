import type { MouseEvent } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { ARTIFACT_ARROW } from '../../helpers/output_format'
import { assistive } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import styles from './step_link.module.css'

export interface StepLinkProps {
  url: string
  /** The visible label, without the arrow. */
  label: string
  /** Asks the host to open the address, since the view cannot navigate. */
  onOpenLink: (url: string) => void
  /** Placement only. */
  className?: string
}

/**
 * A link recorded on a step, drawn as anachoic's ArtifactList draws a name
 * that is a link: underlined, in the colour of the text around it, with the
 * address as its title. A press asks the host to open it, and the frame
 * never navigates.
 */
export function StepLink({ url, label, onOpenLink, className }: StepLinkProps) {
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
      target="_blank"
      rel="noopener noreferrer"
      onClick={open}
      onAuxClick={(event) => event.preventDefault()}
      className={joinClasses(styles.link, className)}
    >
      {label}
      <span aria-hidden="true">{` ${ARTIFACT_ARROW}`}</span>
      <VisuallyHidden>{` ${assistive.opensInNewTab}`}</VisuallyHidden>
    </a>
  )
}
