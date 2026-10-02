import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { actionResultSchema, boardPropsSchema } from '../../shared/props.js'
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
  { title: 'Open the PR', owner: 'agent', output_format: 'pull_request' },
  { title: 'Review the PR', owner: 'user' },
  { title: 'Merge it', owner: 'agent' },
]

const URL = 'https://github.com/acme/api/pull/12'

function storedSteps() {
  return query<{
    number: number
    owner: string
    output_format: string | null
    artifact_url: string | null
  }>(
    dataDir,
    'SELECT number, owner, output_format, artifact_url FROM steps ORDER BY task_id, number'
  )
}

async function board() {
  const { result } = await ok(view, 'get_board', {})
  return boardPropsSchema.parse(result.structuredContent)
}

test('add_task takes an output format on an agent step, and refuses one on a user step', async () => {
  await ok(api, 'add_task', { title: 'Ship the fix', steps: REVIEW_CHAIN })
  expect(storedSteps()).toEqual([
    { number: 1, owner: 'agent', output_format: 'pull_request', artifact_url: null },
    { number: 2, owner: 'you', output_format: null, artifact_url: null },
    { number: 3, owner: 'agent', output_format: null, artifact_url: null },
  ])

  for (const [client, name, args] of [
    [api, 'add_task', { steps: [{ title: 'Review', owner: 'user', output_format: 'document' }] }],
    [api, 'add_task', { steps: [{ title: 'Review', owner: 'you', output_format: 'document' }] }],
    [
      view,
      'add_task_from_view',
      { steps: [{ title: 'Review', owner: 'you', outputFormat: 'document' }] },
    ],
  ] as const) {
    const refused = await call(client, name, { title: 'Docs', ...args })
    expect(refused).toMatchObject({
      isError: true,
      text: 'Only agent steps can declare an output format',
    })
  }
  expect(storedSteps()).toHaveLength(3)
})

test('add_task takes owner "user" and its alias "you" as user steps', async () => {
  await ok(api, 'add_task', {
    title: 'Both',
    steps: [
      { title: 'Check', owner: 'user' },
      { title: 'Check again', owner: 'you' },
    ],
    queue: false,
  })
  expect(storedSteps().map(({ owner }) => owner)).toEqual(['you', 'you'])
  const props = await board()
  expect(props.backlog[0].steps.map(({ owner }) => owner)).toEqual(['you', 'you'])
})

test('the view adds formatted agent steps, and the board props carry them', async () => {
  const { result } = await ok(view, 'add_task_from_view', {
    title: 'File it',
    steps: [{ title: 'File the ticket', owner: 'agent', outputFormat: 'ticket' }],
  })
  const props = actionResultSchema.parse(result.structuredContent)
  expect(props.queue[0].steps[0]).toMatchObject({ outputFormat: 'ticket' })

  await ok(api, 'claim_step', {})
  const working = await board()
  expect(working.working[0].step).toMatchObject({ outputFormat: 'ticket' })
})

test('a formatted agent step needs artifact_url, and the next user step receives it', async () => {
  await ok(api, 'add_task', { title: 'Ship the fix', steps: REVIEW_CHAIN })
  const claimed = await ok(api, 'claim_step', {})
  expect(claimed.text).toContain(
    'Produces: a pull request. Finish with complete_step and artifact_url.'
  )

  expect(
    await call(api, 'complete_step', { task: 'T-001', summary: 'Opened the PR' })
  ).toMatchObject({
    isError: true,
    text: 'Step 1 of T-001 needs a pull request link (artifact_url)',
  })
  expect(
    await call(api, 'complete_step', {
      task: 'T-001',
      summary: 'Opened the PR',
      artifact_url: 'ftp://example.com/pr',
    })
  ).toMatchObject({ isError: true, text: 'That is not a web address' })
  expect(storedSteps()[0]).toMatchObject({ artifact_url: null })

  await ok(api, 'complete_step', { task: 'T-001', summary: 'Opened the PR', artifact_url: URL })
  expect(storedSteps()[0]).toMatchObject({ artifact_url: URL })

  const props = await board()
  expect(props.yourTurn[0].input).toEqual({ stepNumber: 1, format: 'pull_request', url: URL })
  expect(props.yourTurn[0].steps[0]).toMatchObject({
    outputFormat: 'pull_request',
    artifactUrl: URL,
  })

  const summary = await ok(api, 'show_board', {})
  expect(summary.text).toContain(`Waiting on user (1): T-001 step 2 "Review the PR" is the user's`)

  const { result } = await ok(view, 'complete_my_step', { task: 'T-001', note: 'Two nits' })
  const after = actionResultSchema.parse(result.structuredContent)
  expect(after.queue[0].artifacts).toEqual([{ stepNumber: 1, format: 'pull_request', url: URL }])

  const merge = await ok(api, 'claim_step', {})
  expect(merge.text).not.toContain('Input from')
  expect(merge.text).toContain(`Artifacts:\nStep 1 (agent): Pull request ${URL}`)
})

test('the next agent step reads the input in claim_step', async () => {
  await ok(api, 'add_task', {
    title: 'Write it up',
    steps: [
      { title: 'Draft the doc', owner: 'agent', output_format: 'document' },
      { title: 'Link it from the README', owner: 'agent' },
    ],
  })
  await ok(api, 'claim_step', {})
  const url = 'https://docs.example.com/plan'
  await ok(api, 'complete_step', { task: 'T-001', summary: 'Drafted', artifact_url: url })

  const next = await ok(api, 'claim_step', { task: 'T-001' })
  expect(next.text.split('\n').slice(0, 2)).toEqual([
    'Claimed T-001 step 2 of 2: "Link it from the README"',
    `Input from step 1: Document ${url}`,
  ])
  const props = await board()
  expect(props.working[0].step.outputFormat).toBeUndefined()
})

test('a user step has no URL to give when it is marked done', async () => {
  await ok(api, 'add_task', { title: 'Check', steps: [{ title: 'Check', owner: 'user' }] })
  await ok(view, 'complete_my_step', { task: 'T-001', artifactUrl: 'https://example.com' })
  expect(storedSteps()[0]).toMatchObject({ artifact_url: null })
})

test('add_follow_up takes an output format on an agent step only', async () => {
  await ok(api, 'add_task', { title: 'Docs', steps: [{ title: 'Write', owner: 'agent' }] })
  await ok(api, 'claim_step', {})
  await ok(api, 'complete_step', { task: 'T-001', summary: 'Written' })

  expect(
    await call(api, 'add_follow_up', {
      task: 'T-001',
      placement: 'last',
      steps: [{ title: 'Check', owner: 'user', output_format: 'link' }],
    })
  ).toMatchObject({ isError: true, text: 'Only agent steps can declare an output format' })

  await ok(api, 'add_follow_up', {
    task: 'T-001',
    placement: 'last',
    steps: [{ title: 'Publish', owner: 'agent', output_format: 'link' }],
  })
  await ok(api, 'claim_step', { task: 'T-001' })
  await ok(api, 'complete_step', {
    task: 'T-001',
    summary: 'Published',
    artifact_url: 'https://example.com/docs',
  })
  await ok(view, 'add_follow_up_from_view', {
    task: 'T-001',
    placement: 'last',
    steps: [{ title: 'Ship', owner: 'agent', outputFormat: 'document' }],
  })
  expect(storedSteps().map(({ output_format }) => output_format)).toEqual([
    null,
    'link',
    'document',
  ])
})
