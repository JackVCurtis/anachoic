/**
 * A worker's form as the board walks it, page by page. The same rules as the
 * server's (shared/form.ts, which components may not import): pages[0] comes
 * first, a page's next names a later page, and on a "one" page an option's
 * next overrides it.
 */

export type FormChoice = 'one' | 'many' | 'text'

export interface FormOption {
  label: string
  next?: string
}

export interface FormPage {
  id: string
  question: string
  choose: FormChoice
  options?: FormOption[]
  next?: string
}

export interface QuestionFormData {
  pages: FormPage[]
}

/** The user's answer to one page: option indexes, or the typed text. */
export interface FormResponse {
  page: string
  picked?: number[]
  text?: string
}

/** The longest text a page and a direct answer take, as shared/limits.ts sets them. */
export const FORM_TEXT_MAX = 500
export const DIRECT_ANSWER_MAX = 4000

export function pageOf(form: QuestionFormData, id: string): FormPage | undefined {
  return form.pages.find((page) => page.id === id)
}

/** Whether a response answers its page, so the user may go on. */
export function isAnswered(page: FormPage, response: FormResponse | undefined): boolean {
  if (response === undefined || response.page !== page.id) return false
  if (page.choose === 'text') return (response.text ?? '').trim() !== ''
  const picked = response.picked ?? []
  return page.choose === 'one' ? picked.length === 1 : picked.length > 0
}

/** The page an answered page leads to, or null when the form ends there. */
export function nextPageId(page: FormPage, response: FormResponse): string | null {
  if (page.choose === 'one') {
    const option = page.options?.[response.picked?.[0] ?? -1]
    if (option?.next !== undefined) return option.next
  }
  return page.next ?? null
}

/**
 * The pages shown so far: the first, then each page the answers before it
 * lead to, up to the first page not yet answered or the end.
 */
export function pathOf(form: QuestionFormData, responses: readonly FormResponse[]): FormPage[] {
  const path: FormPage[] = []
  let page: FormPage | undefined = form.pages[0]
  for (const response of responses) {
    if (!page || !isAnswered(page, response)) break
    path.push(page)
    const next = nextPageId(page, response)
    page = next === null ? undefined : pageOf(form, next)
  }
  if (page) path.push(page)
  return path
}

/**
 * The fewest and the most pages a walk from this page can still show, itself
 * included. Every next points later, so one pass from the end is enough.
 */
export function pagesLeft(form: QuestionFormData, id: string): { least: number; most: number } {
  const left = new Map<string, { least: number; most: number }>()
  for (const page of [...form.pages].reverse()) {
    const targets =
      page.choose === 'one'
        ? (page.options ?? []).map((option) => option.next ?? page.next)
        : [page.next]
    const after = targets.map((target) =>
      target ? (left.get(target) ?? { least: 0, most: 0 }) : { least: 0, most: 0 }
    )
    left.set(page.id, {
      least: 1 + Math.min(...after.map((each) => each.least)),
      most: 1 + Math.max(...after.map((each) => each.most)),
    })
  }
  return left.get(id) ?? { least: 0, most: 0 }
}

/**
 * Sets the answer to the page at `index` on the path and drops every answer
 * after it, since a changed answer may lead elsewhere.
 */
export function answerPage(
  responses: readonly FormResponse[],
  index: number,
  response: FormResponse
): FormResponse[] {
  return [...responses.slice(0, index), response]
}

/** How the user answers a form: its responses, or their own words instead. */
export type FormAnswer = { responses: FormResponse[] } | { direct: string }
