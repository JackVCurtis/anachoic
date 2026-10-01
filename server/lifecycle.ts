import { describeError, type Logger } from './logger.js'

type Stopper = () => unknown

/**
 * Owns the process's timers and the things that must close on exit. stop()
 * runs once, whatever asks first: a signal, the end of stdin or a failure.
 */
export function createLifecycle(logger: Logger, exit: (code: number) => void = process.exit) {
  const timers = new Set<NodeJS.Timeout>()
  const stoppers: Stopper[] = []
  let stopping = false

  return {
    every(milliseconds: number, task: () => void) {
      const timer = setInterval(task, milliseconds)
      timers.add(timer)
      return () => {
        clearInterval(timer)
        timers.delete(timer)
      }
    },
    onStop(stopper: Stopper) {
      stoppers.push(stopper)
    },
    async stop(reason: string, code = 0) {
      if (stopping) {
        return
      }
      stopping = true
      for (const timer of timers) {
        clearInterval(timer)
      }
      timers.clear()
      for (const stopper of stoppers) {
        try {
          await stopper()
        } catch (error) {
          logger.log('stop_failed', describeError(error))
        }
      }
      logger.log('exit', { reason, code })
      exit(code)
    },
  }
}
