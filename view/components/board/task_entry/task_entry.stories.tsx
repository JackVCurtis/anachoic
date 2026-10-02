import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  TASK_ENTRY_DRAFTS,
  TASK_ENTRY_FIELD_ERRORS,
  TASK_ENTRY_WORKERS,
} from '../../fixtures/task_entry'
import { taskEntry } from '../../helpers/strings'
import { ViewFrame } from '../../testing/view_frame'
import { TaskEntry } from './task_entry'

const meta = {
  title: 'Board/TaskEntry',
  component: TaskEntry,
  args: {
    open: true,
    draft: TASK_ENTRY_DRAFTS.typed,
    busy: null,
    fieldError: null,
    onOpen: fn(),
    onCancel: fn(),
    onDraftChange: fn(),
    onSubmit: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The hint is text-hint in --color-text-faint, below 4.5:1 by design
       * (ui/16, "Built as designed"). The contrast of the text roles belongs
       * to the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof TaskEntry>

export default meta

type Story = StoryObj<typeof meta>

/** The same story drawn at the narrow width, 600 px. */
function narrow(story: Story, name: string): Story {
  return {
    ...story,
    name: `${name}, narrow`,
    globals: { viewport: { value: 'narrow', isRotated: false } },
    parameters: { ...story.parameters, frame: 'narrow' },
  }
}

export const Collapsed: Story = {
  name: 'Collapsed',
  args: { open: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('textbox')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: taskEntry.addTask }))
    await expect(args.onOpen).toHaveBeenCalledOnce()
  },
}

export const Empty: Story = {
  name: 'Empty',
  args: { draft: TASK_ENTRY_DRAFTS.empty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: taskEntry.add })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: taskEntry.addToQueue })).toBeDisabled()
    await expect(canvas.getByText(taskEntry.needsTitle)).toBeVisible()
  },
}

export const Default: Story = {
  name: 'Typed',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: taskEntry.addToQueue }))
    await expect(args.onSubmit).toHaveBeenCalledWith('queue')
    await expect(canvas.getByText(taskEntry.hint)).toBeVisible()
  },
}

export const OneUserStep: Story = {
  name: 'One user step',
  args: { draft: TASK_ENTRY_DRAFTS.oneYours },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Owner of step 2' })
    await expect(within(group).getByRole('radio', { name: 'User' })).toBeChecked()
  },
}

export const TwentySteps: Story = {
  name: '20 steps, the most a task has',
  args: { draft: TASK_ENTRY_DRAFTS.twenty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(20)
    await expect(canvas.queryByRole('button', { name: taskEntry.addStep })).toBeNull()
  },
}

export const DetailOpen: Story = {
  name: 'Detail open',
  args: { draft: TASK_ENTRY_DRAFTS.detail },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('textbox', { name: 'Detail of step 1' })
    ).toHaveValue(TASK_ENTRY_DRAFTS.detail.steps[0].detail)
  },
}

export const Invalid: Story = {
  name: 'A step without a title',
  args: { draft: TASK_ENTRY_DRAFTS.stepUntitled },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: taskEntry.add })).toBeDisabled()
    await expect(canvas.getByText(taskEntry.stepNeedsTitle)).toBeVisible()
  },
}

export const Submitting: Story = {
  name: 'Adding to the queue',
  args: { busy: 'queue' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: taskEntry.addToQueue })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('button', { name: taskEntry.add })).toBeDisabled()
    await expect(canvas.getByRole('textbox', { name: taskEntry.title })).toBeEnabled()
  },
}

export const FieldError: Story = {
  name: 'The server refused a field',
  args: { fieldError: TASK_ENTRY_FIELD_ERRORS.stepTitle },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: 'Title of step 2' })
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(TASK_ENTRY_FIELD_ERRORS.stepTitle.text)
    await expect(canvas.queryByText(taskEntry.hint)).toBeNull()
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { draft: TASK_ENTRY_DRAFTS.longTitle },
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form')!
    await expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth)
  },
}

export const WithWorkers: Story = {
  name: 'With live workers',
  args: { workers: TASK_ENTRY_WORKERS.two },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('combobox', { name: taskEntry.workerLabel })
    await expect(
      within(field)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual([taskEntry.anyWorker, 'api-server', 'web-client'])
    await expect(field).toHaveValue('')
    await userEvent.selectOptions(field, 'api-server')
    await expect(args.onDraftChange).toHaveBeenCalledWith({
      ...TASK_ENTRY_DRAFTS.typed,
      assignTo: 'worker-api-server',
    })
  },
}

export const Assigned: Story = {
  name: 'Assigned to a worker',
  args: { draft: TASK_ENTRY_DRAFTS.assigned, workers: TASK_ENTRY_WORKERS.two },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: taskEntry.workerLabel })
    ).toHaveValue('worker-web-client')
  },
}

export const LongWorkerName: Story = {
  name: 'A worker named with 40 characters',
  args: {
    draft: { ...TASK_ENTRY_DRAFTS.typed, assignTo: TASK_ENTRY_WORKERS.longName[0].id },
    workers: TASK_ENTRY_WORKERS.longName,
  },
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form')!
    await expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth)
  },
}

export const WithOutput: Story = {
  name: 'Agent steps with an Output field',
  args: { draft: TASK_ENTRY_DRAFTS.withOutput },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: 'Output of step 1' })).toHaveValue(
      'pull_request'
    )
    await expect(canvas.queryByRole('combobox', { name: 'Output of step 2' })).toBeNull()
    await expect(canvas.getByRole('combobox', { name: 'Output of step 3' })).toHaveValue('')
  },
}

export const CollapsedNarrow = narrow(Collapsed, 'Collapsed')
export const EmptyNarrow = narrow(Empty, 'Empty')
export const TypedNarrow = narrow(Default, 'Typed')
export const OneUserStepNarrow = narrow(OneUserStep, 'One user step')
export const TwentyStepsNarrow = narrow(TwentySteps, '20 steps')
export const DetailOpenNarrow = narrow(DetailOpen, 'Detail open')
export const InvalidNarrow = narrow(Invalid, 'A step without a title')
export const SubmittingNarrow = narrow(Submitting, 'Adding to the queue')
export const FieldErrorNarrow = narrow(FieldError, 'The server refused a field')
export const LongTitleNarrow = narrow(LongTitle, 'Long title')
export const WithWorkersNarrow = narrow(WithWorkers, 'With live workers')
export const AssignedNarrow = narrow(Assigned, 'Assigned to a worker')
export const LongWorkerNameNarrow = narrow(LongWorkerName, 'A worker named with 40 characters')
export const WithOutputNarrow = narrow(WithOutput, 'Agent steps with an Output field')
