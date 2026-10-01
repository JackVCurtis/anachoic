import { isBuiltin } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

/**
 * The top-level folder of the repository an absolute path sits in, or null
 * when the path is outside the repository.
 */
function topFolder(path) {
  const inside = relative(ROOT, path)
  if (inside === '' || inside.startsWith('..') || inside.startsWith(sep)) {
    return null
  }
  return inside.split(sep)[0]
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

const imports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keeps the dependency direction between the top-level folders, and node modules out of the pure ones.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
          nodeBuiltins: { type: 'boolean' },
        },
        required: ['allow'],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const { allow, nodeBuiltins = true } = context.options[0]
    const from = topFolder(context.filename)
    if (from === null) {
      return {}
    }

    return importVisitors((node, specifier) => {
      const path = specifier.split('?')[0]

      if (!path.startsWith('.')) {
        if (!nodeBuiltins && isBuiltin(path)) {
          context.report({
            node,
            message: `${from}/ is pure and imports no node module, not even '${specifier}'.`,
          })
        }
        return
      }

      const to = topFolder(resolve(dirname(context.filename), path))
      if (to === null || allow.includes(to)) {
        return
      }
      context.report({
        node,
        message: `${from}/ may not import from ${to}/. It may import only ${allow.map((folder) => `${folder}/`).join(', ')}.`,
      })
    })
  },
}

/**
 * The dependency direction between the repository's top-level folders.
 */
export const folderRules = {
  meta: { name: 'anachoic-folders' },
  rules: { imports },
}
