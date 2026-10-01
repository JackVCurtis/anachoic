import { App, applyHostFonts, applyHostStyleVariables, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import barlowDataUrl from '@fontsource/barlow/files/barlow-latin-400-normal.woff2?inline'

const viewId = Math.random().toString(36).slice(2, 8)
const bootedAt = Date.now()
const events: string[] = []
const fontResults: Record<string, string> = {}
const cspViolations: string[] = []
let hostContext: McpUiHostContext | undefined
let toolResult: unknown
let tick = 0
let polling = true
let intersecting: boolean | null = null

const $ = (id: string) => document.getElementById(id)!
$('view-id').textContent = viewId

function note(kind: string, detail?: unknown) {
  const line = `${((Date.now() - bootedAt) / 1000).toFixed(1)}s ${kind}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`
  events.unshift(line)
  render()
}

function render() {
  $('events').textContent = events.slice(0, 80).join('\n')
  $('fonts').textContent = JSON.stringify({ fontResults, cspViolations, hostFontCss: hostContext?.styles?.css?.fonts?.slice(0, 300) }, null, 2)
  $('state').textContent = JSON.stringify(
    {
      viewId,
      tick,
      polling,
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      intersecting,
      size: [innerWidth, innerHeight],
      hostCapabilities: app.getHostCapabilities(),
      hostContext,
      toolResult,
    },
    null,
    2
  )
}

document.addEventListener('securitypolicyviolation', (event) => {
  cspViolations.push(`${event.violatedDirective} blocked ${event.blockedURI.slice(0, 40)}`)
  render()
})

async function probeFonts() {
  const base64 = barlowDataUrl.slice(barlowDataUrl.indexOf(',') + 1)
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const attempts: [string, () => Promise<unknown>][] = [
    ['ProbeCssData', () => document.fonts.load('18px ProbeCssData')],
    ['ProbeFaceUrl', () => new FontFace('ProbeFaceUrl', `url(${barlowDataUrl})`).load().then((f) => document.fonts.add(f))],
    ['ProbeFaceBuffer', () => new FontFace('ProbeFaceBuffer', bytes.buffer).load().then((f) => document.fonts.add(f))],
  ]
  for (const [name, attempt] of attempts) {
    try {
      await attempt()
      fontResults[name] = document.fonts.check(`18px ${name}`) ? 'loaded' : 'not loaded'
    } catch (error) {
      fontResults[name] = `error: ${(error as Error).message}`
    }
  }
  render()
  report('fonts', { fontResults, cspViolations })
}

const app = new App({ name: 'anachoic-probe', version: '0.0.1' }, {}, { autoResize: true })

function report(kind: string, detail: unknown) {
  app.callServerTool({ name: 'probe_view_event', arguments: { viewId, kind, detail } }).catch((error) => note('report failed', String(error)))
}

app.ontoolinput = (params) => note('ontoolinput', params)
app.ontoolinputpartial = () => note('ontoolinputpartial')
app.ontoolresult = (result) => {
  toolResult = result.structuredContent
  note('ontoolresult')
  report('toolresult', { toolInfo: hostContext?.toolInfo, structuredContent: result.structuredContent })
}
app.ontoolcancelled = (params) => note('ontoolcancelled', params)
app.onhostcontextchanged = (change) => {
  hostContext = { ...hostContext, ...change }
  if (change.styles?.variables) applyHostStyleVariables(change.styles.variables)
  if (change.styles?.css?.fonts) applyHostFonts(change.styles.css.fonts)
  note('onhostcontextchanged', Object.keys(change))
  report('hostcontextchanged', change)
}
app.onteardown = async () => {
  report('teardown', { tick })
  note('onteardown')
  return {}
}
app.onerror = (error) => note('onerror', String(error))

const actions: Record<string, () => Promise<unknown>> = {
  sendMessage: () =>
    app.sendMessage({ role: 'user', content: [{ type: 'text', text: `Probe view ${viewId} sent this message at tick ${tick}. Reply with one word.` }] }),
  updateModelContext: () =>
    app.updateModelContext({ content: [{ type: 'text', text: `Probe context from view ${viewId}: the secret word is "heron-${tick}".` }] }),
  fullscreen: () => app.requestDisplayMode({ mode: 'fullscreen' }),
  pip: () => app.requestDisplayMode({ mode: 'pip' }),
  inline: () => app.requestDisplayMode({ mode: 'inline' }),
  openLink: () => app.openLink({ url: 'https://modelcontextprotocol.io/extensions/apps/overview' }),
  callWhoami: () => app.callServerTool({ name: 'probe_whoami', arguments: {} }),
  togglePoll: async () => {
    polling = !polling
    document.querySelector('[data-action=togglePoll]')!.textContent = polling ? 'pause polling' : 'resume polling'
  },
}

document.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).dataset.action
  if (!action) return
  actions[action]()
    .then((result) => {
      note(`${action} ok`, result)
      report(`action ${action}`, { ok: true, result })
    })
    .catch((error) => {
      note(`${action} failed`, String(error))
      report(`action ${action}`, { ok: false, error: String(error) })
    })
})

new IntersectionObserver(([entry]) => {
  intersecting = entry.isIntersecting
  render()
}).observe(document.body)
document.addEventListener('visibilitychange', () => note('visibilitychange', document.visibilityState))

await app.connect()
hostContext = app.getHostContext()
if (hostContext?.styles?.variables) applyHostStyleVariables(hostContext.styles.variables)
if (hostContext?.styles?.css?.fonts) applyHostFonts(hostContext.styles.css.fonts)
note('connected')
report('connected', { hostContext, hostCapabilities: app.getHostCapabilities(), userAgent: navigator.userAgent })
probeFonts()

setInterval(() => {
  if (!polling) return
  tick++
  app
    .callServerTool({
      name: 'probe_poll',
      arguments: { viewId, toolCallId: hostContext?.toolInfo?.id, tick, visibility: document.visibilityState, hasFocus: document.hasFocus(), intersecting },
    })
    .then(() => render())
    .catch((error) => note('poll failed', String(error)))
}, 5000)
