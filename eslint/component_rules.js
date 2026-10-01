// Copied from anachoic eslint/component_rules.js at fd99e0d
import { basename, dirname, relative, resolve, sep } from 'node:path'

/**
 * The folders of view/components/ and what a file in each may import from
 * inside the library. Every folder may import from itself. `types` is the
 * root types.ts file.
 */
const SCREEN_FOLDERS = ['board', 'task']

const BASE = ['helpers', 'hooks', 'types']

const LAYER_IMPORTS = {
  types: [],
  helpers: ['types'],
  hooks: ['helpers', 'types'],
  fixtures: ['helpers', 'types'],
  testing: [...BASE, 'fixtures'],
  primitives: [...BASE],
  patterns: [...BASE, 'primitives'],
  ...Object.fromEntries(
    SCREEN_FOLDERS.map((folder) => [folder, [...BASE, 'primitives', 'patterns']])
  ),
}

function folderName(layer) {
  return layer === 'types' ? 'types.ts' : `${layer}/`
}

/**
 * Folders only stories, tests and the folder itself may import from.
 */
const TEST_ONLY = {
  fixtures: 'Fixtures are for stories and tests only. No component, page or layout imports them.',
  testing: 'The test setup is for stories and tests only. No component, page or layout imports it.',
}

const STORY_OR_TEST = /\.(?:stories|test)\.[cm]?[jt]sx?$/
const BARREL = /^index\.[cm]?[jt]sx?$/

/**
 * Where view/ and view/components/ sit, given the path of the file
 * being linted. Null for a file outside view/.
 */
function locate(filename) {
  const parts = filename.split(sep)
  const index = parts.lastIndexOf('view')
  if (index === -1) {
    return null
  }
  const view = parts.slice(0, index + 1).join(sep)
  return { view, components: resolve(view, 'components') }
}

/**
 * The library folder an absolute path belongs to, or null when the path is
 * outside view/components/. A folder not listed in LAYER_IMPORTS is
 * returned by name, so it can be told apart and refused.
 */
function layerOf(path, components) {
  const inside = relative(components, path)
  if (inside === '' || inside.startsWith('..') || inside.startsWith(sep)) {
    return null
  }
  const [first] = inside.split(sep)
  return first.replace(/\.[cm]?[jt]sx?$/, '')
}

/**
 * The absolute path an import specifier points at, or null for a package.
 * Handles relative paths and the `~/` alias for view/.
 */
function resolveSpecifier(specifier, filename, view) {
  const path = specifier.split('?')[0]
  if (path.startsWith('./') || path.startsWith('../') || path === '.' || path === '..') {
    return resolve(dirname(filename), path)
  }
  if (path.startsWith('~/')) {
    return resolve(view, path.slice(2))
  }
  return null
}

function describeAllowed(layer) {
  const allowed = LAYER_IMPORTS[layer].map(folderName)
  const own =
    layer === 'types' ? [] : [SCREEN_FOLDERS.includes(layer) ? 'its own folder' : `other ${layer}`]
  const list = [...allowed, ...own]
  return list.length === 0 ? 'nothing from the library' : list.join(', ')
}

/**
 * Calls `check` with the literal source of every import, re-export and
 * dynamic import in the file.
 */
function importVisitors(check) {
  const visit = (node) => {
    if (node.source && node.source.type === 'Literal' && typeof node.source.value === 'string') {
      check(node.source, node.source.value)
    }
  }
  return {
    ImportDeclaration: visit,
    ExportNamedDeclaration: visit,
    ExportAllDeclaration: visit,
    ImportExpression: visit,
  }
}

const layers = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keeps the folders of view/components/ in their layers, and fixtures and the test setup out of components, pages and layouts.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename
    const place = locate(filename)
    if (!place) {
      return {}
    }

    const isStoryOrTest = STORY_OR_TEST.test(basename(filename))
    const from = layerOf(filename, place.components)
    const known = from !== null && from in LAYER_IMPORTS

    return importVisitors((node, specifier) => {
      const target = resolveSpecifier(specifier, filename, place.view)

      if (target === null) {
        if (from === 'helpers' && !isStoryOrTest) {
          context.report({
            node,
            message: `Helpers import no package, not even '${specifier}'. They may import only types.ts and other helpers.`,
          })
        }
        return
      }

      const to = layerOf(target, place.components)
      if (to === null) {
        return
      }

      if (to in TEST_ONLY) {
        const allowed = isStoryOrTest || from === to || (to === 'fixtures' && from === 'testing')
        if (!allowed) {
          context.report({ node, message: TEST_ONLY[to] })
        }
        return
      }

      if (!known || to === from || LAYER_IMPORTS[from].includes(to)) {
        return
      }

      const name = from === 'types' ? 'types.ts' : `A file in ${from}/`
      context.report({
        node,
        message: `${name} may not import from ${folderName(to)}. It may import only ${describeAllowed(from)}.`,
      })
    })
  },
}

const noBarrelFiles = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbids index files that re-export a folder of view/components/.' },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        if (BARREL.test(basename(context.filename))) {
          context.report({
            node,
            message:
              'No barrel files in view/components/. Import a component from its own file.',
          })
        }
      },
    }
  },
}

/**
 * The function type a prop is declared with, looking through `| undefined`
 * and `| null`. Null when the prop is not a function.
 */
function functionType(annotation) {
  if (!annotation) {
    return null
  }
  if (annotation.type === 'TSFunctionType') {
    return annotation
  }
  if (annotation.type === 'TSUnionType') {
    const rest = annotation.types.filter(
      (type) => type.type !== 'TSUndefinedKeyword' && type.type !== 'TSNullKeyword'
    )
    return rest.length === 1 ? functionType(rest[0]) : null
  }
  return null
}

function propName(key) {
  if (key.type === 'Identifier') {
    return key.name
  }
  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value
  }
  return null
}

const callbackPropNames = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Callback props of a component take the `on` prefix.' },
    schema: [],
  },
  create(context) {
    const checkMembers = (members) => {
      for (const member of members) {
        const isCallback =
          member.type === 'TSMethodSignature' ||
          (member.type === 'TSPropertySignature' &&
            functionType(member.typeAnnotation?.typeAnnotation) !== null)
        const name = isCallback ? propName(member.key) : null
        if (name !== null && !/^on[A-Z]/.test(name)) {
          context.report({
            node: member.key,
            message: `Callback prop '${name}' must take the 'on' prefix, as in 'onOpenTask'.`,
          })
        }
      }
    }

    return {
      TSInterfaceDeclaration(node) {
        if (node.id.name.endsWith('Props')) {
          checkMembers(node.body.body)
        }
      },
      TSTypeAliasDeclaration(node) {
        if (node.id.name.endsWith('Props') && node.typeAnnotation.type === 'TSTypeLiteral') {
          checkMembers(node.typeAnnotation.members)
        }
      },
    }
  },
}

/**
 * Rules for the component library in view/components/.
 */
export const componentRules = {
  meta: { name: 'anachoic-components' },
  rules: {
    'layers': layers,
    'no-barrel-files': noBarrelFiles,
    'callback-prop-names': callbackPropNames,
  },
}
