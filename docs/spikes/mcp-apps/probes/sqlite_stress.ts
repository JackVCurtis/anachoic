import { fork } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bump, openProbeDatabase } from './sqlite_probe.ts'

const [, , role, file, countArg, holdArg] = process.argv

if (role === 'worker') {
  const db = openProbeDatabase(file)
  let busy = 0
  for (let i = 0; i < Number(countArg); i++) {
    try {
      bump(db, `pid ${process.pid} #${i}`, Number(holdArg))
    } catch (error) {
      busy++
      console.error(`pid ${process.pid}: ${(error as Error).message}`)
    }
  }
  db.close()
  process.send!({ busy })
} else {
  const processes = Number(process.env.PROCS ?? 8)
  const perProcess = Number(process.env.WRITES ?? 500)
  const hold = Number(process.env.HOLD_MS ?? 0)
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'probe-sqlite-'))
  const dbFile = path.join(dir, 'board.sqlite')
  openProbeDatabase(dbFile).close()
  const started = Date.now()
  const results = await Promise.all(
    Array.from({ length: processes }, () =>
      new Promise<{ busy: number }>((resolve, reject) => {
        const child = fork(import.meta.filename, ['worker', dbFile, String(perProcess), String(hold)])
        child.on('message', (m) => resolve(m as { busy: number }))
        child.on('exit', (code) => code !== 0 && reject(new Error(`worker exit ${code}`)))
      })
    )
  )
  const db = openProbeDatabase(dbFile)
  const { revision } = db.prepare('SELECT revision FROM board WHERE id = 1').get() as { revision: number }
  const { n, min, max } = db.prepare('SELECT count(*) n, min(revision) min, max(revision) max FROM writes').get() as Record<string, number>
  const failed = results.reduce((sum, r) => sum + r.busy, 0)
  console.log(JSON.stringify({ processes, perProcess, hold, ms: Date.now() - started, failed, revision, rows: n, min, max, contiguous: n === max && min === 1, expected: processes * perProcess - failed }))
  fs.rmSync(dir, { recursive: true })
}
