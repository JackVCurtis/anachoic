import type { ServerContext } from '@modelcontextprotocol/server'

/**
 * What the tools that wait inside a call share: wait_for_answer and
 * wait_for_work.
 */

/**
 * Resolves after `ms`, or as soon as the signal aborts.
 */
export function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

/**
 * Sends progress at each interval while the call waits, when the client
 * asked for it with a progressToken. Returns the function that stops it.
 */
export function keepAlive(
  request: ServerContext,
  intervalMs: number,
  onFailure: (error: unknown) => void
) {
  const progressToken = request.mcpReq._meta?.progressToken
  if (progressToken === undefined) return () => {}
  let progress = 0
  const timer = setInterval(() => {
    progress += 1
    request.mcpReq
      .notify({ method: 'notifications/progress', params: { progressToken, progress } })
      .catch(onFailure)
  }, intervalMs)
  return () => clearInterval(timer)
}
