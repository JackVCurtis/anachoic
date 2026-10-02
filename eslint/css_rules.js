/**
 * Token use in the component library's CSS modules, after anachoic's rules
 * for using tokens (ui/02): colour, type and motion come from tokens, and
 * spacing between blocks from --space-* or the small gaps.
 *
 * ESLint has no CSS parser here, so the `css` processor hands each CSS module
 * to the `tokens` rule as a script of line comments, one per line of CSS. Line
 * numbers carry over; columns are moved back by the comment marker.
 */

const MARKER = '//'

const NAMED_COLOURS = [
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'silver',
  'orange',
  'yellow',
  'purple',
  'pink',
  'navy',
  'teal',
]

/** A gap of this many pixels or fewer is a hairline gap, which may be written in px. */
const HAIRLINE_GAP_PX = 4

const CHECKS = [
  {
    pattern: /#[\da-f]{3,8}\b/gi,
    message: 'A raw colour. Use a colour token from view/css/tokens.css.',
  },
  {
    pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi,
    message: 'A raw colour. Use a colour token; color-mix() is written only in tokens.css.',
  },
  {
    pattern: new RegExp(`(?<=:[^;]*)\\b(?:${NAMED_COLOURS.join('|')})\\b`, 'gi'),
    message: 'A named colour. Use a colour token from view/css/tokens.css.',
  },
  {
    pattern: /\bfont-family:(?!\s*(?:var\(--font-|inherit\b))/gi,
    message: 'A font family by name. Use --font-heading, --font-body or --font-mono.',
  },
  {
    pattern: /--terminal-/g,
    message: 'The views have no terminal, and its tokens are dropped.',
  },
  {
    pattern: /\b(?:transition|animation)(?:-duration|-delay)?:[^;]*?\b\d*\.?\d+m?s\b/gi,
    message: 'A raw duration. Use a --motion-* token.',
  },
]

/** gap and margin values in px wider than a hairline gap. */
const WIDE_GAP = /\b(?:gap|row-gap|column-gap|margin(?:-[a-z-]+)?):[^;]*?(?<![\w.-])(\d*\.?\d+)px/gi

/**
 * The CSS with each comment blanked out, keeping every line and column.
 */
function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

const tokens = {
  meta: {
    type: 'problem',
    docs: { description: 'CSS modules take colour, type, motion and block spacing from tokens' },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context
    return {
      Program() {
        const lines = sourceCode.lines.map((line) =>
          line.startsWith(MARKER) ? line.slice(MARKER.length) : line
        )
        withoutComments(lines.join('\n'))
          .split('\n')
          .forEach((line, index) => {
            const report = (column, message) =>
              context.report({
                loc: { line: index + 1, column: column + MARKER.length },
                message,
              })
            for (const { pattern, message } of CHECKS) {
              for (const match of line.matchAll(pattern)) {
                report(match.index, message)
              }
            }
            for (const match of line.matchAll(WIDE_GAP)) {
              if (Number(match[1]) > HAIRLINE_GAP_PX) {
                report(
                  match.index,
                  'A gap or margin in px. Use --space-*, --gap-stack or --gap-rows.'
                )
              }
            }
          })
      },
    }
  },
}

const css = {
  meta: { name: 'anachoic-css' },
  preprocess(text) {
    const script = text
      .split('\n')
      .map((line) => `${MARKER}${line}`)
      .join('\n')
    return [{ text: script, filename: 'tokens.cssjs' }]
  },
  postprocess(messages) {
    return messages.flat().map((message) => ({
      ...message,
      column: Math.max(1, message.column - MARKER.length),
    }))
  },
  supportsAutofix: false,
}

export const cssRules = {
  meta: { name: 'anachoic-css' },
  processors: { css },
  rules: { tokens },
}
