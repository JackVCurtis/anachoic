import { describe, expect, test } from 'vitest'
import {
  ARTIFACT_URL_MAX,
  artifactLinkLabel,
  artifactUrlProblem,
  isWebAddress,
  OUTPUT_OPTIONS,
} from './output_format'

describe('isWebAddress', () => {
  test.each([
    'https://github.com/acme/api/pull/42',
    'http://intranet.local/doc',
    `https://example.com/${'a'.repeat(ARTIFACT_URL_MAX - 20)}`,
  ])('takes %s', (text) => {
    expect(isWebAddress(text)).toBe(true)
  })

  test.each([
    '',
    'github.com/acme/api/pull/42',
    'ftp://example.com/file',
    'mailto:someone@example.com',
    'javascript:alert(1)',
    `https://example.com/${'a'.repeat(ARTIFACT_URL_MAX)}`,
  ])('refuses %s', (text) => {
    expect(isWebAddress(text)).toBe(false)
  })
})

describe('artifactUrlProblem', () => {
  test('says what is needed while the field is empty or spaces', () => {
    expect(artifactUrlProblem('pull_request', '')).toBe('Needs a pull request link')
    expect(artifactUrlProblem('link', '   ')).toBe('Needs a link')
    expect(artifactUrlProblem('ticket', '')).toBe('Needs a ticket link')
  })

  test('says a typed text is not a web address', () => {
    expect(artifactUrlProblem('document', 'the doc')).toBe('That is not a web address')
  })

  test('is null for a web address, spaces around it trimmed', () => {
    expect(artifactUrlProblem('document', ' https://docs.example.com/d/1 ')).toBeNull()
  })
})

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
