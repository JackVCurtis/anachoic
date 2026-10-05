import { LIMITS } from './limits.js'

/**
 * The form a worker asks the user with, as 16 describes it: short pages, each
 * one question, that may branch on the answer. Shared by the domain, which
 * checks it, the server, which renders the answers as markdown, and the view,
 * which walks it page by page. Pure, so the view can import it.
 */

export const FORM_CHOICES = ['one', 'many', 'text'] as const

export type FormChoice = (typeof FORM_CHOICES)[number]

export interface FormOption {
  label: string
  /** On a "one" page only: the page this option leads to. */
  next?: string
}

export interface FormPage {
  id: string
  question: string
  choose: FormChoice
  /** On "one" and "many" pages only. */
  options?: FormOption[]
  /** The page that follows when no option says otherwise. None ends the form. */
  next?: string
}

export interface Form {
  /** pages[0] is where the form starts. */
  pages: FormPage[]
}

/**
 * The user's answer to one page: option indexes on a choice page, the typed
 * text on a text page.
 */
export interface FormResponse {
  page: string
  picked?: number[]
  text?: string
}

export const FORM_PAGE_ID = /^[a-z0-9_-]{1,32}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textProblem(
  field: 'formQuestion' | 'formOption' | 'formText',
  value: unknown,
  name: string
): string | null {
  const { min, max } = LIMITS[field]
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    return `${name} must be ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')} characters`
  }
  return null
}

/**
 * Whether the form can be walked: unique ids, every next naming a later page,
 * every page reachable from the first, options only where they belong. The
 * limits on text and counts are checked by validateForm, at input only.
 */
export function formShapeProblem(form: unknown): string | null {
  if (!isRecord(form) || !Array.isArray(form.pages) || form.pages.length === 0) {
    return 'form.pages must be a list of pages'
  }
  const pages = form.pages as unknown[]
  const at = new Map<string, number>()
  for (const [index, page] of pages.entries()) {
    const name = `form.pages[${index}]`
    if (!isRecord(page)) return `${name} must be a page`
    if (typeof page.id !== 'string' || !FORM_PAGE_ID.test(page.id)) {
      return `${name}.id must be 1 to 32 characters of a-z, 0-9, _ and -`
    }
    if (at.has(page.id)) return `${name}.id "${page.id}" is used by another page`
    at.set(page.id, index)
    if (typeof page.question !== 'string') return `${name}.question must be text`
    if (!(FORM_CHOICES as readonly unknown[]).includes(page.choose)) {
      return `${name}.choose must be one, many or text`
    }
    if (page.choose === 'text') {
      if (page.options !== undefined) return `${name} is a text page and takes no options`
    } else if (!Array.isArray(page.options)) {
      return `${name}.options must be a list of options`
    }
  }

  const reached = new Set<number>([0])
  // Every next points later, so a page's reach is settled before it is read.
  const lead = (target: unknown, from: number, name: string, taken = true): string | null => {
    if (target === undefined) return null
    const to = typeof target === 'string' ? at.get(target) : undefined
    if (to === undefined) return `${name} names no page of the form`
    if (to <= from) return `${name} must name a later page`
    if (taken && reached.has(from)) reached.add(to)
    return null
  }
  for (const [index, page] of (pages as FormPage[]).entries()) {
    const name = `form.pages[${index}]`
    const options = page.options ?? []
    for (const [each, option] of options.entries()) {
      const optionName = `${name}.options[${each}]`
      if (!isRecord(option)) return `${optionName} must be an option`
      if (typeof option.label !== 'string') return `${optionName}.label must be text`
      if (option.next !== undefined && page.choose !== 'one') {
        return `${optionName}.next is allowed only on a "one" page; use the page's next`
      }
      const problem = lead(option.next, index, `${optionName}.next`)
      if (problem) return problem
    }
    const fallsThrough =
      page.choose !== 'one' || options.some((option) => option.next === undefined)
    const problem = lead(page.next, index, `${name}.next`, fallsThrough)
    if (problem) return problem
  }
  const unreached = pages.findIndex((_, index) => !reached.has(index))
  if (unreached !== -1) return `form.pages[${unreached}] cannot be reached from the first page`
  return null
}

/**
 * The full check of a form a worker sends: its shape, then the limits of
 * shared/limits.ts on its pages, options and text.
 */
export function validateForm(form: unknown): string | null {
  if (isRecord(form) && Array.isArray(form.pages)) {
    const { min, max } = LIMITS.formPages
    if (form.pages.length < min || form.pages.length > max) {
      return `form.pages must be ${min} to ${max} pages`
    }
  }
  const shape = formShapeProblem(form)
  if (shape) return shape
  for (const [index, page] of (form as Form).pages.entries()) {
    const name = `form.pages[${index}]`
    const problem = textProblem('formQuestion', page.question, `${name}.question`)
    if (problem) return problem
    if (page.choose === 'text') continue
    const options = page.options ?? []
    const { min, max } = LIMITS.formOptions
    if (options.length < min || options.length > max) {
      return `${name}.options must be ${min} to ${max} options`
    }
    const labels = new Set<string>()
    for (const [each, option] of options.entries()) {
      const label = textProblem('formOption', option.label, `${name}.options[${each}].label`)
      if (label) return label
      const key = option.label.trim().toLowerCase()
      if (labels.has(key)) return `${name}.options[${each}].label repeats another option's label`
      labels.add(key)
    }
  }
  return null
}

export function pageOf(form: Form, id: string): FormPage | undefined {
  return form.pages.find((page) => page.id === id)
}

/**
 * Whether a response answers its page: one pick on a "one" page, at least one
 * on a "many" page, all in range and none repeated, or the text on a text
 * page.
 */
export function responseProblem(page: FormPage, response: FormResponse | undefined): string | null {
  const name = `The answer to "${page.id}"`
  if (response === undefined || response.page !== page.id) return `${name} is missing`
  if (page.choose === 'text') {
    if (response.picked !== undefined) return `${name} must be text, not picks`
    return textProblem('formText', response.text, name)
  }
  if (response.text !== undefined) return `${name} must be picks, not text`
  const picked = response.picked ?? []
  const count = page.options?.length ?? 0
  const valid =
    picked.every((each) => Number.isInteger(each) && each >= 0 && each < count) &&
    new Set(picked).size === picked.length
  if (!valid) return `${name} picks an option the page does not have`
  if (page.choose === 'one' && picked.length !== 1) return `${name} must pick exactly one option`
  if (page.choose === 'many' && picked.length === 0) return `${name} must pick at least one option`
  return null
}

/**
 * The page an answered page leads to, or null when the form ends there.
 */
export function nextPageId(page: FormPage, response: FormResponse): string | null {
  if (page.choose === 'one') {
    const option = page.options?.[response.picked?.[0] ?? -1]
    if (option?.next !== undefined) return option.next
  }
  return page.next ?? null
}

/**
 * The most pages a walk from this page can still show, itself included.
 * Every next points later, so one pass from the end is enough.
 */
export function pagesLeftAtMost(form: Form, id: string): number {
  const most = new Map<string, number>()
  for (const page of [...form.pages].reverse()) {
    const targets =
      page.choose === 'one'
        ? (page.options ?? []).map((option) => option.next ?? page.next)
        : [page.next]
    const after = Math.max(0, ...targets.map((target) => (target ? (most.get(target) ?? 0) : 0)))
    most.set(page.id, 1 + after)
  }
  return most.get(id) ?? 0
}

/**
 * Checks that the responses walk the form from its first page to an end,
 * each answering the page the answers before it lead to.
 */
export function checkResponses(form: Form, responses: readonly FormResponse[]): string | null {
  let id: string | null = form.pages[0]?.id ?? null
  for (const response of responses) {
    if (id === null) return `The answers go past the end of the form at "${response.page}"`
    const page = pageOf(form, id)
    if (!page) return `The form has no page "${id}"`
    if (response.page !== id) {
      return `The answers skip "${id}": the answer after the last must be to "${id}", not "${response.page}"`
    }
    const problem = responseProblem(page, response)
    if (problem) return problem
    id = nextPageId(page, response)
  }
  return id === null ? null : `The answers stop before the form ends: "${id}" is not answered`
}

/**
 * Answers that checkResponses accepted, as the markdown the worker receives:
 * each page's question as a heading, then the picked labels as a list or the
 * typed text as a paragraph.
 */
export function renderAnswer(form: Form, responses: readonly FormResponse[]): string {
  return responses
    .map((response) => {
      const page = pageOf(form, response.page)
      if (!page) return ''
      const answer =
        page.choose === 'text'
          ? (response.text ?? '').trim()
          : (response.picked ?? [])
              .map((index) => `- ${page.options?.[index]?.label.trim() ?? ''}`)
              .join('\n')
      return `### ${page.question.trim()}\n${answer}`
    })
    .join('\n\n')
}

/**
 * A plain-text answer the user gave instead of the form, as markdown.
 */
export function renderDirectAnswer(text: string): string {
  return `### Answered directly\nThe user skipped the form and answered in their own words:\n\n${text.trim()}`
}

/**
 * The form in one line, for texts that show it briefly: the first question,
 * and how many more pages it may ask.
 */
export function firstQuestion(form: Form): string {
  const first = form.pages[0]?.question.trim() ?? ''
  const more = pagesLeftAtMost(form, form.pages[0]?.id ?? '') - 1
  return more > 0 ? `${first} (+${more} more)` : first
}
