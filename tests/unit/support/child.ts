import { fork, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { build } from 'esbuild'

const built = new Map<string, Promise<string>>()

/**
 * Bundles a child script the way the server build does, with migrations as
 * text, so a forked process runs the store's real code under plain Node.
 */
export function buildChild(entry: string): Promise<string> {
  let output = built.get(entry)
  if (!output) {
    const outfile = join(
      mkdtempSync(join(tmpdir(), 'anachoic-child-')),
      `${basename(entry, '.ts')}.mjs`
    )
    output = build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      outfile,
      logLevel: 'warning',
      loader: { '.sql': 'text' },
    }).then(() => outfile)
    built.set(entry, output)
  }
  return output
}

export interface Child<Message> {
  process: ChildProcess
  messages: Message[]
  next(): Promise<Message>
  exited: Promise<number | null>
}

/**
 * Forks a built child script, collecting the messages it sends.
 */
export function forkChild<Message>(script: string, args: string[]): Child<Message> {
  const child = fork(script, args, {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    execArgv: ['--no-warnings'],
  })
  const messages: Message[] = []
  const waiting: Array<(message: Message) => void> = []
  let stderr = ''
  child.stderr?.on('data', (chunk) => (stderr += String(chunk)))
  child.on('message', (message) => {
    const resolve = waiting.shift()
    if (resolve) resolve(message as Message)
    else messages.push(message as Message)
  })
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (code !== 0 && signal === null) reject(new Error(`Child exited with ${code}: ${stderr}`))
      else resolve(code)
    })
  })
  return {
    process: child,
    messages,
    next: () =>
      messages.length > 0
        ? Promise.resolve(messages.shift()!)
        : new Promise<Message>((resolve) => waiting.push(resolve)),
    exited,
  }
}
