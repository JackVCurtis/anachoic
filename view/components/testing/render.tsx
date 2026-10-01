// Copied from anachoic inertia/components/testing/render.tsx at fd99e0d
import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { FIXED_NOW } from '../fixtures/clock'
import { NowProvider } from '../hooks/use_now/use_now'
import type { Tone } from '../types'
import { ToneFrame } from './tone_frame'

export interface ComponentRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** The present moment the component sees. FIXED_NOW unless given. */
  now?: string
  /** The tone scope around the component. Light unless given. */
  tone?: Tone
}

/**
 * Renders a component the way a story does: under the fixed clock and inside
 * the tone scope asked for. Returns Testing Library's queries with a
 * user-event instance set up for this render.
 */
export function renderComponent(
  ui: ReactElement,
  { now = FIXED_NOW, tone = 'light', ...options }: ComponentRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NowProvider now={now}>
        <ToneFrame tone={tone}>{children}</ToneFrame>
      </NowProvider>
    )
  }

  const user = userEvent.setup()
  return { user, ...render(ui, { ...options, wrapper: Wrapper }) }
}

/**
 * Renders a component inside the given tone scope, under the fixed clock.
 */
export function renderInTone(
  ui: ReactElement,
  tone: Tone,
  options: Omit<ComponentRenderOptions, 'tone'> = {}
) {
  return renderComponent(ui, { ...options, tone })
}
