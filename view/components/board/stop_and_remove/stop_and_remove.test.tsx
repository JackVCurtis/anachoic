import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { sessions as strings } from '../../helpers/strings'
import { renderComponent, renderInTone } from '../../testing/render'
import { StopAndRemove } from './stop_and_remove'

function renderControl(busy = false) {
  const onConfirm = vi.fn()
  const rendered = renderComponent(
    <StopAndRemove
      workerName="api-server"
      taskDisplayId="T-012"
      busy={busy}
      onConfirm={onConfirm}
    />
  )
  return { ...rendered, onConfirm }
}

describe('StopAndRemove', () => {
  test('asks first, naming the worker and the task, then confirms', async () => {
    const { user, onConfirm } = renderControl()

    await user.click(screen.getByRole('button', { name: strings.stopAndRemove }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      screen.getByText('Stop and remove api-server? Its step on T-012 goes back to the queue.')
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: strings.stopAndRemove }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  test('Keep worker dismisses the question and returns focus to the button', async () => {
    const { user, onConfirm } = renderControl()

    await user.click(screen.getByRole('button', { name: strings.stopAndRemove }))
    await user.click(screen.getByRole('button', { name: strings.keepWorker }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: strings.stopAndRemove })).toHaveFocus()
  })

  test('on the inverted field it is an inverted outline button', () => {
    renderInTone(
      <StopAndRemove
        workerName="api-server"
        taskDisplayId="T-012"
        onConfirm={vi.fn()}
        tone="inverse"
      />,
      'inverse'
    )

    expect(screen.getByRole('button', { name: strings.stopAndRemove })).toBeVisible()
  })
})
