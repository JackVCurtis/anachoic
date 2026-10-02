import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { actionResultSchema } from '../../shared/props.js'
import { connect, query, textOf } from './support/server.js'

let dataDir: string
let view: Client
let api: Client
const clients: Client[] = []

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'anachoic-data-'))
  view = await connect({ dataDir, clientName: 'claude-ai' })
  api = await connect({
    dataDir,
    clientName: 'claude-code',
    env: { CLAUDE_CODE_SESSION_ID: 'worker-a', CLAUDE_PROJECT_DIR: '/w/api-server' },
  })
  clients.push(view, api)
})

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await rm(dataDir, { recursive: true, force: true })
})

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args })
  return { text: textOf(result), isError: result.isError ?? false, result }
}

async function ok(client: Client, name: string, args: Record<string, unknown>) {
  const { text, isError, result } = await call(client, name, args)
  expect(isError, text).toBe(false)
  return { text, result }
}

const REVIEW_CHAIN = [
  { title: 'Open the PR', owner: 'agent' },
  { title: 'Review the PR', owner: 'you', output_format: 'pull_request' },
  { title: 'Merge it', owner: 'agent' },
]

function storedSteps() {
  return query<{ number: number; output_format: string | null; artifact_url: string | null }>(
    dataDir,
    'SELECT number, output_format, artifact_url FROM steps ORDER BY task_id, number'
  )
}

test('add_task takes an output format on your step, and refuses one on an agent step', async () => {
  await ok(api, 'add_task', { title: 'Ship the fix', steps: REVIEW_CHAIN })
  expect(storedSteps()).toEqual([
    { number: 1, output_format: null, artifact_url: null },
    { number: 2, output_format: 'pull_request', artifact_url: null },
    { number: 3, output_format: null, artifact_url: null },
  ])

  for (const [client, name, args] of [
    [api, 'add_task', { steps: [{ title: 'Write', owner: 'agent', output_format: 'document' }] }],
    [
      view,
      'add_task_from_view',
      { steps: [{ title: 'Write', owner: 'agent', outputFormat: 'document' }] },
    ],
  ] as const) {
    const refused = await call(client, name, { title: 'Docs', ...args })
    expect(refused).toMatchObject({
      isError: true,
      text: 'Only your steps can declare an output format',
    })
  }
  expect(storedSteps()).toHaveLength(3)
})

test('the view adds formatted steps, and the board props carry them', async () => {
  const { result } = await ok(view, 'add_task_from_view', {
    title: 'File it',
    steps: [{ title: 'File the ticket', owner: 'you', outputFormat: 'ticket' }],
  })
  const props = actionResultSchema.parse(result.structuredContent)
  expect(props.yourTurn[0].step.outputFormat).toBe('ticket')
  expect(props.yourTurn[0].steps[0]).toMatchObject({ outputFormat: 'ticket' })
})

test('complete_my_step needs a valid URL on a formatted step, and the next worker reads it', async () => {
  await ok(api, 'add_task', { title: 'Ship the fix', steps: REVIEW_CHAIN })
  await ok(api, 'claim_step', {})
  await ok(api, 'complete_step', { task: 'T-001', summary: 'Opened the PR' })

  expect(await call(view, 'complete_my_step', { task: 'T-001' })).toMatchObject({
    isError: true,
    text: 'Step 2 of T-001 needs a pull request link',
  })
  expect(
    await call(view, 'complete_my_step', { task: 'T-001', artifactUrl: 'ftp://example.com/pr' })
  ).toMatchObject({ isError: true, text: 'That is not a web address' })
  expect(storedSteps()[1]).toMatchObject({ artifact_url: null })

  const url = 'https://github.com/acme/api/pull/12'
  const { result } = await ok(view, 'complete_my_step', {
    task: 'T-001',
    artifactUrl: url,
    note: 'Two nits',
  })
  expect(storedSteps()[1]).toMatchObject({ artifact_url: url })
  const props = actionResultSchema.parse(result.structuredContent)
  expect(props.queue[0].artifacts).toEqual([{ stepNumber: 2, format: 'pull_request', url }])
  expect(props.queue[0].steps[1]).toMatchObject({ outputFormat: 'pull_request', artifactUrl: url })

  const board = await ok(api, 'show_board', {})
  expect(board.text).toContain(`T-001 "Ship the fix" next: agent (step 2: Pull request ${url})`)

  const claimed = await ok(api, 'claim_step', {})
  expect(claimed.text).toContain(`Artifacts:\nStep 2 (you): Pull request ${url}`)
})

test('add_follow_up takes an output format on your step', async () => {
  await ok(api, 'add_task', { title: 'Docs', steps: [{ title: 'Write', owner: 'agent' }] })
  await ok(api, 'claim_step', {})
  await ok(api, 'complete_step', { task: 'T-001', summary: 'Written' })

  expect(
    await call(api, 'add_follow_up', {
      task: 'T-001',
      placement: 'last',
      steps: [{ title: 'More', owner: 'agent', output_format: 'link' }],
    })
  ).toMatchObject({ isError: true, text: 'Only your steps can declare an output format' })

  await ok(view, 'add_follow_up_from_view', {
    task: 'T-001',
    placement: 'last',
    steps: [{ title: 'Publish', owner: 'you', outputFormat: 'document' }],
  })
  expect(storedSteps()[1]).toMatchObject({ output_format: 'document' })
})
