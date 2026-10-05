import { screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { BRANCHING, PICK_THE_CACHE } from '../../fixtures/forms'
import type { FormResponse, QuestionFormData } from '../../helpers/question_form'
import { questionForm } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { QuestionForm } from './question_form'

function Harness({
  form,
  onSubmit,
  onAnswerDirectly = () => {},
}: {
  form: QuestionFormData
  onSubmit: (responses: FormResponse[]) => void
  onAnswerDirectly?: () => void
}) {
  const [responses, setResponses] = useState<FormResponse[]>([])
  return (
    <QuestionForm
      form={form}
      responses={responses}
      onChange={setResponses}
      onSubmit={onSubmit}
      onAnswerDirectly={onAnswerDirectly}
    />
  )
}

const button = (name: string) => screen.getByRole('button', { name })

describe('QuestionForm', () => {
  test('a one-page form answers at once and shows no progress', async () => {
    const onSubmit = vi.fn()
    const { user } = renderComponent(<Harness form={PICK_THE_CACHE} onSubmit={onSubmit} />)

    expect(screen.queryByText(/Question 1/)).toBeNull()
    expect(button(questionForm.answer)).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'In-process' }))
    await user.click(button(questionForm.answer))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith([{ page: 'cache', picked: [1] }])
  })

  test('the pages shown follow the answers, and focus moves to each new question', async () => {
    const onSubmit = vi.fn()
    const { user } = renderComponent(<Harness form={BRANCHING} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('radio', { name: 'In-process' }))
    await user.click(button(questionForm.next))
    expect(screen.getByRole('checkbox', { name: 'Search results' })).toHaveFocus()
    expect(screen.queryByRole('textbox')).toBeNull()

    expect(button(questionForm.next)).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Facet counts' }))
    await user.click(button(questionForm.next))
    expect(screen.getByText('Question 3 of 3')).toBeVisible()
    await user.click(screen.getByRole('radio', { name: '1 hour' }))
    await user.click(button(questionForm.answer))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith([
      { page: 'cache', picked: [1] },
      { page: 'scope', picked: [1] },
      { page: 'ttl', picked: [2] },
    ])
  })

  test('unchecking the only pick of a "many" page holds the form there', async () => {
    const { user } = renderComponent(<Harness form={BRANCHING} onSubmit={vi.fn()} />)
    await user.click(screen.getByRole('radio', { name: 'In-process' }))
    await user.click(button(questionForm.next))

    const results = screen.getByRole('checkbox', { name: 'Search results' })
    await user.click(results)
    expect(button(questionForm.next)).toBeEnabled()
    await user.click(results)
    expect(button(questionForm.next)).toBeDisabled()
  })

  test('Answer directly is offered on every page', async () => {
    const onAnswerDirectly = vi.fn()
    const { user } = renderComponent(
      <Harness form={BRANCHING} onSubmit={vi.fn()} onAnswerDirectly={onAnswerDirectly} />
    )
    await user.click(screen.getByRole('radio', { name: 'Redis' }))
    await user.click(button(questionForm.next))
    await user.click(button(questionForm.answerDirectly))

    expect(onAnswerDirectly).toHaveBeenCalledOnce()
  })
})
