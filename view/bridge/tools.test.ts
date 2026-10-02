import { describe, expect, test } from 'vitest'
import { FakeApp } from './testing/fake_app'
import { actions, callAppTool, openLink } from './tools'

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

describe('actions.completeMyStep', () => {
  test('sends the note and the artifact URL only when given', async () => {
    const app = new FakeApp({ answer: () => ({ content: [], structuredContent: {} }) })

    await actions.completeMyStep(app, 'T-012')
    await actions.completeMyStep(app, 'T-012', 'Two nits')
    await actions.completeMyStep(app, 'T-012', undefined, 'https://github.com/acme/api/pull/12')

    expect(app.calls.callServerTool).toEqual([
      { name: 'complete_my_step', arguments: { task: 'T-012' } },
      { name: 'complete_my_step', arguments: { task: 'T-012', note: 'Two nits' } },
      {
        name: 'complete_my_step',
        arguments: { task: 'T-012', artifactUrl: 'https://github.com/acme/api/pull/12' },
      },
    ])
  })
})

describe('openLink', () => {
  test('asks the host to open the address', async () => {
    const app = new FakeApp()

    expect(await openLink(app, 'https://github.com/o/r/pull/7')).toBe(true)
    expect(app.calls.openLink).toEqual([{ url: 'https://github.com/o/r/pull/7' }])
  })

  test('is false when the host refuses or cannot be reached', async () => {
    const refusing = { openLink: async () => ({ isError: true }) }
    const failing = {
      openLink: async () => {
        throw new Error('Gone')
      },
    }

    expect(await openLink(refusing, 'https://example.com')).toBe(false)
    expect(await openLink(failing, 'https://example.com')).toBe(false)
  })
})
