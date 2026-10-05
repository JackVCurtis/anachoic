# 16. Question forms

Added on 2026-10-05, at the product owner's request: "I want to restrict the worker agents' capacity to dump text on the user of the board interface. Instead of allowing the worker to ask questions in text, I want to create a JSON form/wizard api. Questions should be limited to 250 characters and answer labels to 150 characters. The API must allow multi-step and conditional logic … Answers should come back to the worker as markdown-formatted text once the whole wizard has been completed." And: "a user should be able to override the whole form input with a plain text 'Answer Directly' button."

This document is the authority for how a worker asks the user. It replaces the free-text `question` of [03](03-domain-model.md), [05](05-sessions.md#waiting-for-your-answer) and [06](06-tools-and-views.md). It also shortens the `block_step` reason of [12](12-blocked-steps.md) to 1–250 characters, so that a worker cannot put long text on the board that way either.

## The form

`ask_you` takes a `form` instead of a question. A form is a list of pages that the board shows one at a time. `shared/form.ts` holds the types and every check, and the domain, the server and the view all share them.

```jsonc
{ "pages": [
  { "id": "cache", "question": "Which cache should the search endpoint use?", "choose": "one",
    "options": [ { "label": "Redis", "next": "prefix" }, { "label": "In-process", "next": "scope" } ] },
  { "id": "prefix", "question": "What key prefix should it use?", "choose": "text", "next": "ttl" },
  { "id": "scope", "question": "Which responses may it cache?", "choose": "many",
    "options": [ { "label": "Search results" }, { "label": "Facet counts" } ], "next": "ttl" },
  { "id": "ttl", "question": "How long should entries live?", "choose": "one",
    "options": [ { "label": "1 minute" }, { "label": "1 hour" } ] }
]}
```

| Field | Rule |
|---|---|
| pages | 1 to 10. `pages[0]` is shown first. |
| id | 1 to 32 characters of `a-z`, `0-9`, `_` and `-`. Unique in the form. |
| question | 1 to 250 characters |
| choose | `one`: the user picks exactly one option. `many`: the user picks at least one. `text`: the user types 1 to 500 characters. |
| options | On `one` and `many` pages only. There are 2 to 6 of them, and their labels must be unique within the page, ignoring case. |
| label | 1 to 150 characters |
| option `next` | Allowed on a `one` page only. The page that picking this option leads to. |
| page `next` | The page that follows when no option sets one. A page with no `next` ends the form. |

**Branching.** Every `next` must name a page that comes **later** in the list, so a form has no cycles and every path ends within 10 pages. Every page must be reachable from the first page. A page `next` counts towards reachability only when some answer falls through to it.

**Refusals.** These are all `invalid`, and each sentence names the field at fault, for example "form.pages[1].question must be 1 to 250 characters" or "form.pages[3].next must name a later page".

## Answering

The board's `answer_question` takes exactly one of these:

| Input | Meaning |
|---|---|
| `responses` | One `{ page, picked?: number[], text?: string }` for each page shown, in order. `picked` holds option indexes. |
| `direct` | 1 to 4,000 characters: the user's own words instead of the form ("Answer directly") |

The domain walks `responses` from the first page. Each response must answer the page that the answers before it lead to. It must pick exactly one option on a `one` page, at least one on a `many` page, and none twice. On a `text` page it must give the text. The responses must end where the form ends. Anything else is refused with `invalid`, and the step keeps waiting.

## What the worker receives

The answer is stored as markdown, collected once by `wait_for_answer` as before, and sent after "The user answered your question on T-012:".

```md
### Which cache should the search endpoint use?
- In-process

### Which responses may it cache?
- Search results
- Facet counts
```

Each page shown gets a heading with its question. Picks are a list. Typed text is a paragraph. A direct answer reads as follows:

```md
### Answered directly
The user skipped the form and answered in their own words:

Neither: drop the cache
```

## Domain and store

| Field | On | Type | Meaning |
|---|---|---|---|
| form | Step | Form or empty | Replaces `question`. Agent steps only. Set while the step waits on its answers. |
| answer | Step | Markdown or empty | Unchanged, except that it now holds the rendered markdown |

Invariant 7 now reads: a step has a `form` only while it is an agent step that is `waiting`, and a stored form passes the shape check. The length limits apply to input only.

**Migration 009.** The `question` column holds the form as JSON. Any question still open becomes a form of one `text` page with id `q`. That page keeps its old text even when the text is over 250 characters, so it can still be answered.

## Board

| Where | What |
|---|---|
| YourTurnCard, for an agent's step | The form, one page at a time: "Question 2 of 3", or "Question 2 of up to 4" when the branches differ in length. Then the question, with its radios, checkboxes or a text field, and the buttons **Back**, **Next** (or **Answer** on the last page), **Answer directly** and Park. Back keeps the answers given. Changing an answer drops the answers after it. Focus moves to the new page's first control. |
| Answer directly | Replaces the form with the "Answer to the agent" text field, **Answer** and **Back to the form**. The form keeps its answers. |
| Without an answer action | The card shows the first question as text |
| Task view and text views | "Asks" shows the first question, followed by "(+N more)" when more pages may follow |
