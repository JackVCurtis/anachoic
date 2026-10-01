import { describe, expect, test } from 'vitest'
import { FakeApp } from './testing/fake_app'
import { callAppTool } from './tools'

describe('callAppTool', () => {
  test('returns the structuredContent of a result as props', async () => {
    const app = new FakeApp({
      answer: () => ({
        content: [{ type: 'text', text: 'Board, revision 3' }],
        structuredContent: { revision: 3 },
      }),
    })

    const outcome = await callAppTool<{ revision: number }>(app, 'get_board', { sinceRevision: 2 })

    expect(outcome).toEqual({ ok: true, props: { revision: 3 } })
    expect(app.calls.callServerTool).toEqual([
      { name: 'get_board', arguments: { sinceRevision: 2 } },
    ])
  })

  test('returns the refusal sentence of an isError result', async () => {
    const app = new FakeApp({
      answer: () => ({
        content: [{ type: 'text', text: 'T-012 is no longer in the queue.' }],
        isError: true,
      }),
    })

    expect(await callAppTool(app, 'reorder_queue', { task: 'T-012', position: 1 })).toEqual({
      ok: false,
      refusal: 'T-012 is no longer in the queue.',
    })
  })

  test('returns unreachable when the call throws', async () => {
    const app = new FakeApp({ answer: () => new Error('The host went away') })

    expect(await callAppTool(app, 'get_board', {})).toEqual({ ok: false, unreachable: true })
  })
})
