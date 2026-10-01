// Copied from anachoic .storybook/main.ts at fd99e0d
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../view/components/**/*.stories.tsx', '../view/entries/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        /**
         * Storybook would otherwise merge a root vite.config.ts, and the view
         * build's single-file plugin must never reach Storybook.
         */
        viteConfigPath: '.storybook/vite.config.ts',
      },
    },
  },
  core: {
    disableTelemetry: true,
  },
}

export default config
