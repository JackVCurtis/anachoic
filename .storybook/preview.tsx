// Copied from anachoic .storybook/preview.tsx at fd99e0d
import type { Preview } from '@storybook/react-vite'
import type { Tone } from '../view/components/types'
import { FIXED_NOW } from '../view/components/fixtures/clock'
import { NowProvider } from '../view/components/hooks/use_now/use_now'
import { ToneFrame } from '../view/components/testing/tone_frame'
import '../view/css/app.css'

/**
 * The widths a view story is drawn at: the host frame, inline in desktop chat
 * at 735 px, and the narrow width of 600 px. The height is only the window's;
 * a view grows with its content.
 */
const VIEWPORTS = {
  inline: { name: 'Inline in desktop chat (735 px)', styles: { width: '735px', height: '900px' } },
  narrow: { name: 'Narrow (600 px)', styles: { width: '600px', height: '900px' } },
}

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
    },
    viewport: {
      options: VIEWPORTS,
    },
  },
  globalTypes: {
    tone: {
      description: 'The tone scope around the story',
      toolbar: {
        title: 'Tone',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'inverse', title: 'Inverted' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    tone: 'light',
  },
  decorators: [
    /**
     * A story's `tone` parameter wins over the toolbar, so the Inverted
     * stories stay inverted.
     */
    (Story, { parameters, globals }) => {
      const tone: Tone = parameters.tone ?? globals.tone ?? 'light'
      return (
        <ToneFrame tone={tone}>
          <Story />
        </ToneFrame>
      )
    },
    /**
     * Every story sees the same present moment, so time labels read the same
     * on every run. A story may fix another with the `now` parameter.
     */
    (Story, { parameters }) => (
      <NowProvider now={parameters.now ?? FIXED_NOW}>
        <Story />
      </NowProvider>
    ),
  ],
}

export default preview
