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
  test('offers no Clone task, since it has no task entry to fill', async () => {
    await renderTask(fakeApp())

    expect(screen.getByRole('heading', { level: 2, name: 'Add caching' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Clone task' })).toBeNull()
  })

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

describe('Park and Archive in the task entry', () => {
  /**
   * A fake App with T-012 active and parkable until an action succeeds, and
   * the given answer to the action's tool.
   */
  function actionApp(tool: 'move_to_backlog' | 'archive_task', answer: CallToolResult) {
    const active = taskProps(5)
    let current: CallToolResult = taskResult({
      ...active,
      task: { ...active.task, status: 'active', list: 'working' },
      canAct: { park: true, archive: true },
    })
    let revision = 5
    return new FakeApp({
      hostContext: { displayMode: 'inline', timeZone: 'UTC' },
      replayedResult: REPLAYED,
      answer: (params) => {
        const since = params.arguments?.sinceRevision as number | undefined
        if (params.name === tool) {
          if (!answer.isError) {
            revision = 6
            current =
              tool === 'archive_task'
                ? refusedResult('T-012 was archived')
                : taskResult({ ...taskProps(6), canAct: { park: false, archive: true } })
          }
          return answer
        }
        return since === undefined || since < revision
          ? current
          : taskResult({ changed: false, revision: since })
      },
    })
  }

  const ACTED = {
    content: [{ type: 'text' as const, text: 'Done' }],
    structuredContent: {
      revision: 6,
      acted: { task: { id: '12', displayId: 'T-012', title: 'Add caching' } },
    },
  }

  async function confirm(user: ReturnType<typeof userEvent.setup>, action: 'Park' | 'Archive') {
    await user.click(screen.getByRole('button', { name: action }))
    await user.click(screen.getAllByRole('button', { name: action }).at(-1)!)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  }

  test('Park calls move_to_backlog once, posts nothing, and shows the task in the backlog', async () => {
    const app = actionApp('move_to_backlog', ACTED)
    const { user } = await renderTask(app)

    await confirm(user, 'Park')

    expect(app.callsTo('move_to_backlog')).toEqual([
      { name: 'move_to_backlog', arguments: { task: 'T-012' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.queryByRole('button', { name: 'Park' })).toBeNull()
  })

  test('Archive calls archive_task once, posts nothing, and shows that the task was archived', async () => {
    const app = actionApp('archive_task', ACTED)
    const { user } = await renderTask(app)

    await confirm(user, 'Archive')

    expect(app.callsTo('archive_task')).toEqual([
      { name: 'archive_task', arguments: { task: 'T-012' } },
    ])
    expect(app.calls.sendMessage).toEqual([])
    expect(screen.getByText('T-012 was archived')).toBeVisible()
  })

  test('a refusal shows an error strip and posts nothing', async () => {
    const app = actionApp('archive_task', refusedResult('T-012 is not done'))
    const { user } = await renderTask(app)

    await confirm(user, 'Archive')

    expect(screen.getByRole('alert')).toHaveTextContent('T-012 is not done')
    expect(app.calls.sendMessage).toEqual([])
  })
})
