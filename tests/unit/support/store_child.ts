import { closeDatabase, openDatabase } from '../../../store/database.js'
import { isWritten, write } from '../../../store/write.js'

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
}
process.disconnect?.()
