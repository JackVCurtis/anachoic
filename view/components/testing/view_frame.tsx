// Copied from anachoic inertia/components/testing/view_frame.tsx at fd99e0d
import type { ReactNode } from 'react'
import { joinClasses } from '../helpers/join_classes'
import styles from './view_frame.module.css'

/**
 * The widths a view is drawn at: inline in desktop chat, whose container is
 * 735 px wide, and the narrowest host the views are tested at, 600 px.
 */
export const VIEW_WIDTHS = { inline: 735, narrow: 600 } as const

export type ViewWidth = keyof typeof VIEW_WIDTHS

/**
 * Stands in for the host's frame around a view story: a column at the host's
 * width whose height comes from its content, as the view's iframe grows to
 * fit it.
 */
export function ViewFrame({
  width = 'inline',
  children,
}: {
  width?: ViewWidth
  children: ReactNode
}) {
  return (
    <div className={joinClasses(styles.frame, width === 'narrow' && styles.narrow)}>{children}</div>
  )
}

/**
 * How far the document scrolls on each axis, measured once the fonts have
 * loaded, since text sizes depend on them.
 */
export async function windowOverflow(): Promise<[number, number]> {
  await document.fonts.ready
  const root = document.scrollingElement ?? document.documentElement
  return [root.scrollWidth - root.clientWidth, root.scrollHeight - root.clientHeight]
}
