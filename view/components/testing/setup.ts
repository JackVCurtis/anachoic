// Copied from anachoic inertia/components/testing/setup.ts at fd99e0d
import '../../css/app.css'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

/**
 * Testing Library wraps renders and events in act() only when React is told
 * it runs in a test.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/**
 * Vitest runs without globals, so Testing Library cannot register its own
 * cleanup.
 */
afterEach(() => {
  cleanup()
})
