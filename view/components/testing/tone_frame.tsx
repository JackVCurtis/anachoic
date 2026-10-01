// Copied from anachoic inertia/components/testing/tone_frame.tsx at fd99e0d
import type { ReactNode } from 'react'
import type { Tone } from '../types'
import styles from './tone_frame.module.css'

/**
 * Sets a tone scope and paints its field, standing in for an inverted Frame
 * in stories and tests. The light tone renders its children as they are.
 */
export function ToneFrame({ tone, children }: { tone: Tone; children: ReactNode }) {
  if (tone === 'light') {
    return children
  }
  return (
    <div data-tone={tone} className={styles.frame}>
      {children}
    </div>
  )
}
