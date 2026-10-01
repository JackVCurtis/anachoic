// Copied from anachoic .storybook/vite.config.ts at fd99e0d
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The browser code's Vite configuration without the single-file plugin,
 * shared by Storybook and by the Vitest browser projects.
 */
export default defineConfig({
  plugins: [react()],
  /**
   * Found late, these would be optimized mid-run, and Vitest would reload the
   * page under the tests that import them.
   */
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'lucide-react',
      '@testing-library/react',
      '@testing-library/user-event',
      '@modelcontextprotocol/ext-apps',
      '@modelcontextprotocol/ext-apps/app-bridge',
      '@modelcontextprotocol/client',
    ],
  },
})
