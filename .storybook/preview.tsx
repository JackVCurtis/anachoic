// Copied from anachoic .storybook/preview.tsx at fd99e0d
import type { Preview } from '@storybook/react-vite'
import type { Tone } from '../view/components/types'
import { ToneFrame } from '../view/components/testing/tone_frame'
import '../view/css/app.css'

/**
 * The widths a view is drawn at: inline in desktop chat, whose container is
 * 735 px wide, and a narrow host.
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
  ],
}

export default preview
