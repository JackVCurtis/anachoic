import { claim } from '../../../domain/transitions.js'
import { closeDatabase, openDatabase } from '../../../store/database.js'
import { startHeartbeat } from '../../../store/heartbeat.js'
import { claimStep } from '../../../store/services.js'
import { touchSession } from '../../../store/sessions.js'
import { isWritten, write } from '../../../store/write.js'
import { addQueuedTask, transition } from './store.js'

/**
 * A forked process that acts on the store, for the suites that need several
 * processes against one file. It waits for 'go' before acting, so its
 * siblings start together.
 */
const [role, file, ...rest] = process.argv.slice(2)

function send(message: unknown) {
  return new Promise<void>((resolve) => process.send!(message, () => resolve()))
}

function go() {
  return new Promise<void>((resolve) => process.once('message', () => resolve()))
}

await send({ ready: true })
await go()

if (role === 'open') {
  const database = openDatabase(file)
  await send({ applied: database.applied })
  closeDatabase(database)
} else if (role === 'write') {
  const database = openDatabase(file)
  const revisions: number[] = []
  let busy = 0
  for (let index = 0; index < Number(rest[0]); index++) {
    const result = write(database, () => null)
    if (isWritten(result)) revisions.push(result.revision)
    else busy++
  }
  await send({ revisions, busy })
  closeDatabase(database)
} else if (role === 'claim') {
  const [sessionId, task] = rest
  const database = openDatabase(file)
  const result = claimStep(
    database,
    sessionId,
    new Date().toISOString(),
    task === '' ? undefined : task
  )
  await send({ code: 'code' in result ? result.code : 'claimed' })
  closeDatabase(database)
} else if (role === 'serve') {
  // Serves one session that claims a step, then stays alive until killed.
  const [sessionId, intervalMs, deadWindowMs] = rest
  const database = openDatabase(file)
  const heartbeat = startHeartbeat(database, {
    intervalMs: Number(intervalMs),
    deadWindowMs: Number(deadWindowMs),
  })
  heartbeat.serve(sessionId)
  const now = () => new Date().toISOString()
  touchSession(
    database,
    { id: sessionId, kind: 'worker', projectDir: '/work/killed' },
    now(),
    process.pid
  )
  const taskId = addQueuedTask(database, ['agent'], { actor: sessionId, now: now() })
  transition(database, taskId, (state) => claim(state, { actor: sessionId, now: now() }))
  setInterval(() => {}, 1000)
  await send({ taskId })
}
if (role !== 'serve') process.disconnect?.()
