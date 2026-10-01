import { useLayoutEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge'
import type { McpUiStyles } from '@modelcontextprotocol/ext-apps'
import { InMemoryTransport } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useTimeZone } from '../components/hooks/use_now/use_now'
import { connectToHost, createApp, type HostContext, type HostContextStore } from './connect'
import { HostContextProvider, useHostContext } from './host_context'
import { FakeApp } from './testing/fake_app'

const CONNECT_CONTEXT: HostContext = {
  theme: 'light',
  displayMode: 'inline',
  availableDisplayModes: ['inline', 'fullscreen'],
  containerDimensions: { width: 735, maxHeight: 5000 },
  locale: 'en-US',
  timeZone: 'Europe/London',
  safeAreaInsets: { top: 12, right: 12, bottom: 12, left: 12 },
}

let renders = 0
let growth: HTMLDivElement

/**
 * Shows what useHostContext hands the views, and reports each render.
 */
function Probe() {
  const { locale, timeZone, displayMode } = useHostContext()
  useLayoutEffect(onProbeRender)
  return (
    <div style={{ height: 240 }}>
      <p data-testid="locale">{locale}</p>
      <p data-testid="display-mode">{displayMode}</p>
      <p data-testid="time-zone">{timeZone}</p>
      <p data-testid="clock-zone">{useTimeZone()}</p>
    </div>
  )
}

/**
 * Counts each render of the probe and, as the spike's probe view did, grows
 * the page with each one, so a render in answer to new dimensions would change
 * the height and feed a resize loop.
 */
function onProbeRender() {
  renders += 1
  growth.style.height = `${renders * 100}px`
}

function renderProbe(store: HostContextStore) {
  return render(
    <HostContextProvider store={store}>
      <Probe />
    </HostContextProvider>
  )
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function settle(frames = 4) {
  for (let frame = 0; frame < frames; frame += 1) {
    await nextFrame()
  }
}

beforeEach(() => {
  renders = 0
  growth = document.createElement('div')
  document.body.append(growth)
})

afterEach(() => {
  growth.remove()
})

describe('connectToHost with a fake App', () => {
  test('connects once and reads the host context', async () => {
    const app = new FakeApp({ hostContext: CONNECT_CONTEXT })
    const connection = await connectToHost({ app })

    expect(app.calls.connect).toBe(1)
    expect(connection.hostContext.getSnapshot()).toEqual(CONNECT_CONTEXT)
  })

  test('a theme-only update and then a locale update are merged over the context read at connect', async () => {
    const app = new FakeApp({ hostContext: CONNECT_CONTEXT })
    const connection = await connectToHost({ app })
    renderProbe(connection.hostContext)

    act(() => app.emitHostContextChange({ theme: 'dark' }))
    act(() => app.emitHostContextChange({ locale: 'fr-FR' }))

    expect(connection.hostContext.getSnapshot()).toEqual({
      ...CONNECT_CONTEXT,
      theme: 'dark',
      locale: 'fr-FR',
    })
    expect(screen.getByTestId('locale').textContent).toBe('fr-FR')
    expect(screen.getByTestId('display-mode').textContent).toBe('inline')
    expect(screen.getByTestId('time-zone').textContent).toBe('Europe/London')
  })

  test('20 containerDimensions-only updates cause no render and leave the height alone', async () => {
    const app = new FakeApp({ hostContext: CONNECT_CONTEXT })
    const connection = await connectToHost({ app })
    renderProbe(connection.hostContext)
    await settle()
    const rendersBefore = renders
    const heightBefore = document.documentElement.getBoundingClientRect().height

    for (let update = 1; update <= 20; update += 1) {
      act(() =>
        app.emitHostContextChange({ containerDimensions: { width: 735, maxHeight: 5000 + update } })
      )
    }
    await settle()

    expect(renders).toBe(rendersBefore)
    expect(document.documentElement.getBoundingClientRect().height).toBe(heightBefore)
    expect(connection.hostContext.getSnapshot().containerDimensions).toEqual({
      width: 735,
      maxHeight: 5020,
    })
  })

  test("a child reads the host's time zone through useTimeZone", async () => {
    const app = new FakeApp({ hostContext: { ...CONNECT_CONTEXT, timeZone: 'Asia/Kolkata' } })
    const connection = await connectToHost({ app })
    renderProbe(connection.hostContext)

    expect(screen.getByTestId('clock-zone').textContent).toBe('Asia/Kolkata')
  })

  test('the replayed tool result gives only its task id', async () => {
    const seen: string[] = []
    const app = new FakeApp({ hostContext: CONNECT_CONTEXT })
    const connection = await connectToHost({ app, onReplayedTaskId: (id) => seen.push(id) })

    app.emitToolResult({ content: [], structuredContent: { revision: 9, yourTurn: [] } })
    expect(connection.replayedTaskId()).toBeUndefined()

    app.emitToolResult({
      content: [],
      structuredContent: { task: { id: 'task-12', displayId: 'T-012', title: 'Old title' } },
    })
    expect(connection.replayedTaskId()).toBe('task-12')
    expect(seen).toEqual(['task-12'])
    expect(app.calls.callServerTool).toEqual([])
  })
})

describe('connectToHost with the SDK App and AppBridge', () => {
  test('the view settles, and 20 dimension-only changes resize it at most once', async () => {
    const [hostTransport, viewTransport] = InMemoryTransport.createLinkedPair()
    const bridge = new AppBridge(
      null,
      { name: 'anachoic-test-host', version: '0.0.0' },
      { serverTools: {} },
      {
        hostContext: {
          ...CONNECT_CONTEXT,
          theme: 'dark',
          styles: { variables: { '--color-background-primary': '#000000' } as McpUiStyles },
        },
      }
    )
    let sizeChanges = 0
    let hostContext: HostContext = { ...CONNECT_CONTEXT }
    // Desktop answers each size the view reports with new container dimensions.
    bridge.onsizechange = ({ width, height }) => {
      sizeChanges += 1
      hostContext = {
        ...hostContext,
        containerDimensions: { width: width ?? 735, height: height ?? 0 },
      }
      bridge.setHostContext(hostContext)
    }
    await bridge.connect(hostTransport)
    const connection = await connectToHost({ app: createApp(), transport: viewTransport })
    renderProbe(connection.hostContext)
    await settle(10)
    expect(sizeChanges).toBeGreaterThan(0)
    const rendersBefore = renders
    sizeChanges = 0

    for (let update = 1; update <= 20; update += 1) {
      hostContext = {
        ...hostContext,
        containerDimensions: { width: 735, maxHeight: 5000 + update },
      }
      bridge.setHostContext(hostContext)
      await settle(2)
    }
    await settle(10)

    expect(sizeChanges).toBeLessThanOrEqual(1)
    expect(renders).toBe(rendersBefore)
    expect(document.documentElement.style.getPropertyValue('--color-background-primary')).toBe('')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    await bridge.close()
  })
})
