// Copied from anachoic .storybook/preview.tsx at fd99e0d
import type { Preview } from '@storybook/react-vite'

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
}

export default preview
