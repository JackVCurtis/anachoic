// Copied from anachoic inertia/components/patterns/page_header/page_header.tsx at fd99e0d
import type { Ref } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import styles from './page_header.module.css'

export interface PageHeaderProps {
  title: string
  /** One line about the page's content. */
  summary: string
  /** The page's h1, for a script that sends focus to it. */
  titleRef?: Ref<HTMLHeadingElement>
  /** Placement only. */
  className?: string
}

/**
 * The page's h1 and one line about its content, on one baseline.
 */
export function PageHeader({ title, summary, titleRef, className }: PageHeaderProps) {
  return (
    <header className={joinClasses(styles.header, className)}>
      <h1 ref={titleRef} tabIndex={-1} className="text-title-page">
        {title}
      </h1>
      <p className={joinClasses('text-body-sm', styles.summary)}>{summary}</p>
    </header>
  )
}
