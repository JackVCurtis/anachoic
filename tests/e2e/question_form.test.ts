import { setTimeout as sleep } from 'node:timers/promises'
import { callFromHost, expect, ok, test } from './support/harness.js'

/** Redis asks for a key prefix; in-process asks what may be cached. */
const FORM = {
  pages: [
    {
      id: 'cache',
      question: 'Which cache should the search endpoint use?',
      choose: 'one',
      options: [
        { label: 'Redis', next: 'prefix' },
        { label: 'In-process', next: 'scope' },
      ],
    },
    { id: 'prefix', question: 'What key prefix should it use?', choose: 'text' },
    {
      id: 'scope',
      question: 'Which responses may it cache?',
      choose: 'many',
      options: [{ label: 'Search results' }, { label: 'Facet counts' }],
    },
  ],
}

async function askedWorker(board: Parameters<Parameters<typeof test>[2]>[0]['board']) {
  const api = await board.worker('worker-a', 'api-server')
  await ok(api, 'add_task', {
    title: 'Cache the search endpoint',
    steps: [{ title: 'Choose the cache', owner: 'agent' }],
  })
  await ok(api, 'claim_step')
  await ok(api, 'ask_you', { task: 'T-001', form: FORM })
  return api
}

function waitForAnswer(api: Awaited<ReturnType<typeof askedWorker>>) {
  return api
    .callTool({ name: 'wait_for_answer', arguments: { task: 'T-001' } })
    .then((result) => (result.content as Array<{ text: string }>)[0].text)
}

test('the user walks a branching form on the board, and the worker gets the answers as markdown', async ({
  page,
  board,
}) => {
  const api = await askedWorker(board)
  const view = await callFromHost(page, 'show_board')
  await expect(view.getByText('Which cache should the search endpoint use?')).toBeVisible()
  const waiting = waitForAnswer(api)
  await sleep(200)

  await view.getByRole('radio', { name: 'In-process' }).check()
  await view.getByRole('button', { name: 'Next' }).click()
  await view.getByRole('checkbox', { name: 'Search results' }).check()
  await view.getByRole('checkbox', { name: 'Facet counts' }).check()
  await view.getByRole('button', { name: 'Answer', exact: true }).click()

  expect(await waiting).toBe(
    [
      'The user answered your question on T-001:',
      '### Which cache should the search endpoint use?',
      '- In-process',
      '',
      '### Which responses may it cache?',
      '- Search results',
      '- Facet counts',
    ].join('\n')
  )
  await expect(view.getByText('Which cache should the search endpoint use?')).toHaveCount(0)
})

test('Answer directly sends the user’s own words instead of the form', async ({ page, board }) => {
  const api = await askedWorker(board)
  const view = await callFromHost(page, 'show_board')
  await view.getByRole('radio', { name: 'Redis' }).check()
  await view.getByRole('button', { name: 'Answer directly' }).click()
  await view.getByRole('textbox', { name: 'Answer to the agent' }).fill('Neither: drop the cache')
  await view.getByRole('button', { name: 'Answer', exact: true }).click()

  expect(await waitForAnswer(api)).toBe(
    'The user answered your question on T-001:\n### Answered directly\nThe user skipped the form and answered in their own words:\n\nNeither: drop the cache'
  )
})
