import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { CallToolResult } from '@modelcontextprotocol/client'
import { describe, expect, test } from 'vitest'
import { FakeApp, type FakeAppOptions } from '../../bridge/testing/fake_app'
import { refusedResult, taskProps, taskResult } from '../../bridge/testing/task_props'
import { taskView } from '../../components/helpers/strings'
import { ViewFrame } from '../../components/testing/view_frame'
import { loadTask, TaskEntry } from './task_entry'

/** The open_task result the host replays: an old revision, with an old title. */
const REPLAYED = taskResult({
  ...taskProps(1),
  task: { ...taskProps(1).task, title: 'An old title from the replay' },
})

const FULLSCREEN: FakeAppOptions['hostContext'] = {
  displayMode: 'inline',
  availableDisplayModes: ['inline', 'fullscreen'],
  timeZone: 'UTC',
}

/**
 * A fake App that replays an old open_task result, and whose get_task gives
 * the task in full when asked so, else says it has not changed.
 */
function fakeApp(
  task: () => CallToolResult = () => taskResult(taskProps(5)),
  hostContext: FakeAppOptions['hostContext'] = { displayMode: 'inline', timeZone: 'UTC' }
) {
  return new FakeApp({
    hostContext,
    replayedResult: REPLAYED,
    answer: (params) => {
      const since = params.arguments?.sinceRevision as number | undefined
      return since === undefined ? task() : taskResult({ changed: false, revision: since })
    },
  })
}

async function renderTask(app: FakeApp) {
  const loaded = await loadTask({ app })
  render(
    <ViewFrame>
      <TaskEntry {...loaded} />
    </ViewFrame>
  )
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  return { user: userEvent.setup(), loaded }
}

describe('the task entry', () => {
  test('takes only the task id from the replayed result and draws from get_task', async () => {
    const app = fakeApp()
    const { loaded } = await renderTask(app)

    expect(loaded.taskId).toBe('12')
    expect(app.callsTo('get_task')[0].arguments).toEqual({ task: '12' })
    expect(screen.getByRole('heading', { level: 2, name: 'Add caching' })).toBeVisible()
    expect(screen.queryByText('An old title from the replay')).toBeNull()
    expect(app.calls.sendMessage).toEqual([])
  })

  test('shows the refusal in place of the chain when the task is gone', async () => {
    await renderTask(fakeApp(() => refusedResult('T-012 was archived')))

    expect(screen.getByText('T-012 was archived')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'T-012' })).toBeVisible()
  })

  test('with fullscreen available it asks for it on connect, and its return control asks for inline', async () => {
    const app = fakeApp(undefined, FULLSCREEN)
    const { user } = await renderTask(app)
    expect(app.calls.requestDisplayMode).toEqual([{ mode: 'fullscreen' }])

    act(() => app.emitHostContextChange({ displayMode: 'fullscreen' }))
    await user.click(screen.getByRole('button', { name: taskView.backToInline }))

    expect(app.calls.requestDisplayMode).toEqual([{ mode: 'fullscreen' }, { mode: 'inline' }])
    act(() => app.emitHostContextChange({ displayMode: 'inline' }))
    expect(screen.getByRole('button', { name: taskView.openInFullScreen })).toBeVisible()
  })

  test('without fullscreen it stays inline and offers no display control', async () => {
    const app = fakeApp()
    await renderTask(app)

    expect(app.calls.requestDisplayMode).toEqual([])
    expect(screen.queryByRole('button', { name: taskView.openInFullScreen })).toBeNull()
    expect(screen.queryByRole('button', { name: taskView.backToInline })).toBeNull()
  })

  test('a step link opens through the host', async () => {
    const props = taskProps(5)
    props.steps[0] = {
      ...props.steps[0],
      links: [{ label: 'CI run', url: 'https://ci.example.com/1' }],
    }
    const app = fakeApp(() => taskResult(props))
    const { user } = await renderTask(app)

    await user.click(screen.getByRole('link', { name: /CI run/ }))

    expect(app.calls.openLink).toEqual([{ url: 'https://ci.example.com/1' }])
  })
})
