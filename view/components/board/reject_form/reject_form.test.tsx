import { act, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { reject } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { RejectForm } from './reject_form'

/**
 * An opener and the form it shows, as a card holds them.
 */
function Harness({
  onSend = () => {},
  busy = false,
}: {
  onSend?: (note: string) => void
  busy?: boolean
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  return open ? (
    <RejectForm
      tone="plain"
      busy={busy}
      onSend={onSend}
      onCancel={() => setOpen(false)}
      returnFocusTo={opener}
    />
  ) : (
    <button ref={opener} type="button" onClick={() => setOpen(true)}>
      {reject.reject}
    </button>
  )
}

describe('RejectForm', () => {
  test('the note field takes focus, and Send back waits for a note', async () => {
    const onSend = vi.fn()
    const { user } = renderComponent(<Harness onSend={onSend} />)
    await user.click(screen.getByRole('button', { name: reject.reject }))

    const field = screen.getByRole('textbox', { name: reject.label })
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-required', 'true')
    const send = screen.getByRole('button', { name: reject.sendBack })
    expect(send).toBeDisabled()

    await user.type(field, '   ')
    expect(send).toBeDisabled()
    await user.type(field, 'Wrong branch{Enter}')
    expect(onSend).not.toHaveBeenCalled()
    await user.click(send)
    expect(onSend).toHaveBeenCalledWith('Wrong branch')
  })

  test('Cancel and Escape close the form and give focus back to the opener', async () => {
    const { user } = renderComponent(<Harness />)
    await user.click(screen.getByRole('button', { name: reject.reject }))
    await user.click(screen.getByRole('button', { name: reject.cancel }))
    expect(screen.getByRole('button', { name: reject.reject })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: reject.reject }))
    await act(async () => {
      await userEvent.keyboard('{Escape}')
    })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: reject.reject })).toHaveFocus()
  })

  test('the note stops at 2,000 characters', async () => {
    const { user } = renderComponent(<Harness />)
    await user.click(screen.getByRole('button', { name: reject.reject }))
    const field = screen.getByRole('textbox', { name: reject.label })
    await user.click(field)
    await user.paste('x'.repeat(2100))
    expect(field).toHaveValue('x'.repeat(2000))
  })
})
