import { expect, test } from 'vitest'
import { artifactLinkLabel, inputLinkLabel, OUTPUT_OPTIONS, producesLine } from './output_format'

test('the Output field lists None and then each format', () => {
  expect(OUTPUT_OPTIONS.map(({ label }) => label)).toEqual([
    'None',
    'Pull request',
    'Ticket',
    'Document',
    'Link',
  ])
})

test('an artifact link is labelled by its format and step, without the arrow', () => {
  expect(artifactLinkLabel('pull_request', 2)).toBe('Pull request · step 2')
})

test('the link a user step is handed is labelled by its format and step, without the arrow', () => {
  expect(inputLinkLabel('pull_request', 1)).toBe('Pull request from step 1')
  expect(inputLinkLabel('link', 3)).toBe('Link from step 3')
})

test('what a running step produces names its format in lower case', () => {
  expect(producesLine('pull_request')).toBe('Produces a pull request')
  expect(producesLine('document')).toBe('Produces a document')
})
