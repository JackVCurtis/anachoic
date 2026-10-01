// Copied from anachoic inertia/components/hooks/use_escape_layer/use_escape_layer.test.tsx at fd99e0d
import { act, render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { EscapeLayers, EscapeLayersProvider, useEscapeLayer } from './use_escape_layer'

function Layer({ onClose }: { onClose: () => void }) {
  useEscapeLayer(onClose)
  return null
}

describe('EscapeLayers', () => {
  test('closes the layer opened last, and reports false when none is open', () => {
    const layers = new EscapeLayers()
    const outer = vi.fn()
    const inner = vi.fn()
    layers.add(outer)
    const removeInner = layers.add(inner)

    expect(layers.closeInnermost()).toBe(true)
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()

    removeInner()
    layers.closeInnermost()
    expect(outer).toHaveBeenCalledOnce()
  })

  test('a layer is registered only while its component is mounted', () => {
    const layers = new EscapeLayers()
    const onClose = vi.fn()
    const { rerender } = render(
      <EscapeLayersProvider layers={layers}>
        <Layer onClose={onClose} />
      </EscapeLayersProvider>
    )

    act(() => {
      layers.closeInnermost()
    })
    expect(onClose).toHaveBeenCalledOnce()

    rerender(<EscapeLayersProvider layers={layers}>{null}</EscapeLayersProvider>)
    expect(layers.closeInnermost()).toBe(false)
  })

  test('does nothing outside a provider', () => {
    expect(() => render(<Layer onClose={() => {}} />)).not.toThrow()
  })
})
