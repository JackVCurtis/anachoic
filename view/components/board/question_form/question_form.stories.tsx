import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BRANCHING, LONGEST_PAGE, PICK_THE_CACHE } from '../../fixtures/forms'
import type { FormResponse } from '../../helpers/question_form'
import { questionForm } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { QuestionForm, type QuestionFormProps } from './question_form'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

/** Holds the answers as the card does, so the form can be walked. */
function Stateful(props: QuestionFormProps) {
  const [responses, setResponses] = useState<FormResponse[]>([...props.responses])
  return (
    <QuestionForm
      {...props}
      responses={responses}
      onChange={(next) => {
        setResponses(next)
        props.onChange(next)
      }}
    />
  )
}

const meta = {
  title: 'Board/QuestionForm',
  component: QuestionForm,
  args: {
    form: BRANCHING,
    responses: [],
    onChange: fn(),
    onSubmit: fn(),
    onAnswerDirectly: fn(),
  },
  render: (args) => <Stateful {...args} />,
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof QuestionForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A form that branches, on its first page',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Question 1 of 3')).toBeVisible()
    await expect(canvas.getByRole('button', { name: questionForm.next })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: questionForm.answerDirectly })).toBeEnabled()
  },
}

export const OnePage: Story = {
  name: 'One page, one pick',
  args: { form: PICK_THE_CACHE },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: 'Redis' }))
    await userEvent.click(canvas.getByRole('button', { name: questionForm.answer }))
    await expect(args.onSubmit).toHaveBeenCalledWith([{ page: 'cache', picked: [0] }])
  },
}

export const Many: Story = {
  name: 'A page that takes several picks',
  args: { form: BRANCHING, responses: [{ page: 'cache', picked: [1] }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(questionForm.pickMany)).toBeVisible()
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Search results' }))
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Suggestions' }))
    await expect(canvas.getByRole('button', { name: questionForm.next })).toBeEnabled()
  },
}

export const Text: Story = {
  name: 'A page that takes text',
  args: { form: BRANCHING, responses: [{ page: 'cache', picked: [0] }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('textbox', { name: 'What key prefix should it use?' })
    ).toBeVisible()
  },
}

export const LongText: Story = {
  name: 'A question of 250 characters and six options of 150',
  args: { form: LONGEST_PAGE },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const LongTextNarrow: Story = {
  ...LongText,
  name: 'A question of 250 characters and six options of 150, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const Inverted: Story = {
  name: 'On the inverted field, as a Waiting on user card holds it',
  parameters: { tone: 'inverse' },
}

export const LongTextInverted: Story = {
  ...LongText,
  name: 'A question of 250 characters and six options of 150, inverted',
  parameters: { tone: 'inverse' },
}

export const Busy: Story = {
  name: 'Answering',
  args: { form: PICK_THE_CACHE, responses: [{ page: 'cache', picked: [0] }], busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: questionForm.answer })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('radio', { name: 'Redis' })).toBeDisabled()
  },
}

export const Disabled: Story = {
  name: 'While another action is in flight',
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: questionForm.next })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: questionForm.answerDirectly })).toBeDisabled()
  },
}
