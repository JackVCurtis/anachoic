import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'
import { componentRules } from './eslint/component_rules.js'
import { folderRules } from './eslint/folder_rules.js'

const ICON_PRIMITIVE = 'view/components/primitives/icon/icon.tsx'

const VIEW_FILES = ['view/**/*.{ts,tsx}']

// Copied from anachoic eslint.config.js at fd99e0d
const DRAG_AND_DROP_PACKAGES = [
  '@dnd-kit/*',
  '@hello-pangea/dnd',
  '@atlaskit/pragmatic-drag-and-drop*',
  '@formkit/drag-and-drop',
  '@shopify/draggable',
  'dragula',
  'react-dragula',
  'react-beautiful-dnd',
  'react-dnd',
  'react-dnd-*',
  'react-draggable',
  'react-grid-layout',
  'react-movable',
  'react-sortable-hoc',
  'react-sortablejs',
  'sortablejs',
  'swapy',
]

const DRAG_AND_DROP_RESTRICTION = {
  group: DRAG_AND_DROP_PACKAGES,
  message: 'No package is used for drag and drop. Build it on pointer events.',
}

// Copied from anachoic eslint.config.js at fd99e0d
/**
 * What code under view/components/ may not import. Components receive data
 * and callbacks through props and never reach the MCP SDK, the host bridge,
 * the view entries that render them, or code outside view/.
 */
const COMPONENT_IMPORT_RESTRICTIONS = [
  {
    group: ['@modelcontextprotocol/*'],
    message: 'Components never use the MCP SDK. Take data and callbacks through props.',
  },
  {
    regex: String.raw`^(?:\.\./)+(?:view/)?(?:bridge|entries)(?:/|$)`,
    message: 'Components never import the host bridge or a view entry.',
  },
  {
    regex: String.raw`^(?:\.\./)+(?:shared|server|domain|store)(?:/|$)`,
    message: 'Components never import code from outside view/.',
  },
  DRAG_AND_DROP_RESTRICTION,
]

// Copied from anachoic eslint.config.js at fd99e0d
const LUCIDE_RESTRICTION = {
  group: ['lucide-react', 'lucide-react/*'],
  message: 'Only the Icon primitive imports lucide-react. Render <Icon> instead.',
}

/**
 * console.log, console.info and console.debug write to stdout, which carries
 * the MCP protocol.
 */
const STDOUT_CONSOLE = ['log', 'info', 'debug'].map((property) => ({
  object: 'console',
  property,
  message: 'stdout carries the protocol. Log through the logger.',
}))

export default configApp(
  {
    name: 'Anachoic MCP ignored folders',
    ignores: [
      '.cache/**',
      'docs/**',
      'dist/**',
      'mcpb/**',
      'plugin/**',
      'storybook-static/**',
      'test-results/**',
    ],
  },
  ...react.map((config) => ({ ...config, files: VIEW_FILES })),
  {
    name: 'Anachoic MCP folders: view',
    files: ['view/**/*.{ts,tsx}'],
    plugins: { 'anachoic-folders': folderRules },
    rules: { 'anachoic-folders/imports': ['error', { allow: ['view', 'shared'] }] },
  },
  {
    name: 'Anachoic MCP folders: server',
    files: ['server/**/*.ts'],
    plugins: { 'anachoic-folders': folderRules },
    rules: {
      'anachoic-folders/imports': ['error', { allow: ['server', 'domain', 'store', 'shared'] }],
    },
  },
  {
    name: 'Anachoic MCP folders: store',
    files: ['store/**/*.ts'],
    plugins: { 'anachoic-folders': folderRules },
    rules: { 'anachoic-folders/imports': ['error', { allow: ['store', 'domain', 'shared'] }] },
  },
  {
    name: 'Anachoic MCP folders: domain',
    files: ['domain/**/*.ts'],
    plugins: { 'anachoic-folders': folderRules },
    rules: {
      'anachoic-folders/imports': [
        'error',
        { allow: ['domain', 'shared'], nodeBuiltins: false },
      ],
    },
  },
  {
    name: 'Anachoic MCP folders: shared',
    files: ['shared/**/*.ts'],
    plugins: { 'anachoic-folders': folderRules },
    rules: { 'anachoic-folders/imports': ['error', { allow: ['shared'] }] },
  },
  {
    name: 'Anachoic MCP no stdout in server and store',
    files: ['server/**/*.ts', 'store/**/*.ts'],
    rules: { 'no-restricted-properties': ['error', ...STDOUT_CONSOLE] },
  },
  {
    name: 'Anachoic the view never posts to the chat',
    files: VIEW_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='updateModelContext']",
          message:
            'The view never posts to the dedicated chat, and desktop never shows updateModelContext to the model (06, waking the dedicated session).',
        },
        {
          selector: "CallExpression[callee.property.name='sendMessage']",
          message:
            'The view never posts a message to the dedicated chat, which reads the board with show_board (06, waking the dedicated session).',
        },
      ],
    },
  },
  {
    name: 'Anachoic lucide-react only in the Icon primitive, and no drag-and-drop package',
    files: VIEW_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [LUCIDE_RESTRICTION, DRAG_AND_DROP_RESTRICTION] },
      ],
    },
  },
  {
    name: 'Anachoic component layers and fixtures',
    files: VIEW_FILES,
    plugins: { 'anachoic-components': componentRules },
    rules: {
      'anachoic-components/layers': 'error',
    },
  },
  {
    name: 'Anachoic component library conventions',
    files: ['view/components/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}'],
    plugins: { 'anachoic-components': componentRules },
    rules: {
      'anachoic-components/no-barrel-files': 'error',
      'anachoic-components/callback-prop-names': 'error',
    },
  },
  {
    name: 'Anachoic component import rules',
    files: ['view/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...COMPONENT_IMPORT_RESTRICTIONS, LUCIDE_RESTRICTION] },
      ],
    },
  },
  {
    name: 'Anachoic Icon primitive',
    files: [ICON_PRIMITIVE],
    rules: {
      'no-restricted-imports': ['error', { patterns: COMPONENT_IMPORT_RESTRICTIONS }],
    },
  }
)
