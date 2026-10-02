// Copied from anachoic inertia/components/helpers/strings.ts at fd99e0d
/**
 * Every fixed string the views own, grouped by screen. Components and helpers
 * take their words from here and never type them inline.
 *
 * Strings are stored in sentence case; CSS makes a label uppercase.
 *
 * Text in braces is a placeholder that `fillTemplate` replaces. A placeholder
 * that names a noun, such as `{n tasks}`, takes the counted phrase from
 * `plural`, so the noun agrees with its number.
 */

export const message = {
  success: 'Done',
  error: 'Error',
  dismiss: 'Dismiss',
} as const

export const boardHeader = {
  title: 'Board',
  yourTurn: 'Your turn',
  working: 'Working',
  queue: 'Queue',
  toSignOff: 'To sign off',
  count: '{label} {n}',
  countHeard: '{label}: {n tasks}',
  counts: 'Counts',
  updated: 'Updated',
  updatedAt: 'Updated {time}',
  cantReach: "Can't reach the board",
} as const

export const taskEntry = {
  addTask: 'Add task',
  title: 'New task',
  titlePlaceholder: 'What needs doing?',
  workerLabel: 'Worker',
  anyWorker: 'Any worker',
  stepsLabel: 'Steps',
  stepTitleLabel: 'Title of step {n}',
  stepTitlePlaceholder: 'What this step does',
  ownerLabel: 'Owner of step {n}',
  ownerAgent: 'Agent',
  ownerYou: 'You',
  agentChip: 'agent',
  youChip: 'you',
  detail: 'Detail',
  detailLabel: 'Detail of step {n}',
  detailPlaceholder: 'What whoever does this step needs to know',
  addStep: 'Add step',
  removeStep: 'Remove step {n}',
  chainPreview: 'Chain preview',
  chainNote: '{n steps} · {h} for you',
  add: 'Add',
  addToQueue: 'Add to queue',
  cancel: 'Cancel',
  hint: 'Enter to add · ⇧Enter to queue',
  needsTitle: 'A task needs a title',
  stepNeedsTitle: 'A step needs a title',
  outputLabel: 'Output',
  outputStepLabel: 'Output of step {n}',
  outputNone: 'None',
} as const

/**
 * The words of each output format: how a card names it, the label of its
 * field when you mark the step done, and what the step needs, as a sentence
 * ends. The same as the server's (shared/output_format.ts, which components
 * may not import).
 */
export const outputFormat = {
  shown: {
    pull_request: 'Pull request',
    ticket: 'Ticket',
    document: 'Document',
    link: 'Link',
  },
  field: {
    pull_request: 'Pull request link',
    ticket: 'Ticket link',
    document: 'Document link',
    link: 'Link',
  },
  needed: {
    pull_request: 'a pull request link',
    ticket: 'a ticket link',
    document: 'a document link',
    link: 'a link',
  },
} as const

/**
 * Facts any task card can show in its meta line.
 */
export const card = {
  assignedTo: 'Assigned to {name}',
  artifactLink: '{format} · step {n} ↗',
  artifactLinks: 'Links',
  linkNotOpened: "Couldn't open the link",
} as const

export const yourTurn = {
  title: 'Your turn',
  nothingWaiting: 'Nothing waiting on you',
  kindYourStep: 'Your step',
  kindQuestion: 'Asks',
  asks: '{session} asks',
  stepCounter: 'Step {n}/{m}',
  cardCounter: 'Step {n}/{m} · {waited}',
  markDone: 'Mark done',
  noteLabel: 'Note',
  notePlaceholder: 'Add a note for the next step',
  answerLabel: 'Your answer',
  answerPlaceholder: 'Your answer to the agent',
  answer: 'Answer',
  needsAnswer: 'An answer needs some text',
  answerReady: '{session} resumes with this',
  answerReadyUnnamed: 'The session resumes with this',
  park: 'Park',
  parkQuestion: 'Park “{title}”? It moves to the backlog and its step is released.',
  keepStep: 'Keep step',
  needs: 'Needs {needed}',
  urlPlaceholder: 'https://…',
  notWebAddress: 'That is not a web address',
} as const

export const sessions = {
  title: 'Sessions',
  session: 'Session',
  thisChat: 'This chat',
  kindWorker: 'Worker',
  claimedBy: 'Claimed by',
  unclaimed: 'Unclaimed',
  idle: 'Idle',
  running: 'Running',
  waitingOnYou: 'Waiting on you',
  holding: 'Step {n} of {m} · {step title}',
  holdingStep: 'Step {n} · {step title}',
  ended: 'Ended {when}',
  released: 'Released',
  releasedTasks: 'Released {n tasks}',
  nothingLive: 'No session is connected',
} as const

export const working = {
  title: 'Working',
  nothingWorking: 'Nothing is running',
  elapsed: '{elapsed} elapsed',
  latestNote: 'Latest note',
} as const

export const queue = {
  title: 'Queue',
  empty: 'The queue is empty',
  position: '#{n} in line',
  starts: 'starts at step {n}/{m}',
  resumes: 'resumes at step {n}/{m}',
  move: 'Move',
  drop: 'Drop',
  next: 'next: {owner}',
  toBacklog: 'Move to backlog',
} as const

export const backlog = {
  title: 'Backlog',
  empty: 'The backlog is empty',
  toQueue: 'Queue →',
  showAll: 'Show all {n}',
  showFewer: 'Show fewer',
} as const

export const done = {
  title: 'Done',
  nothingToSignOff: 'Nothing waiting for sign-off',
  finished: 'Finished {when}',
  agentTime: 'agent {time}',
  yourTime: 'you {time}',
  links: '{n links}',
  signOff: 'Sign off',
  followUp: 'Follow up',
  followUpTitle: 'Follow-up task',
  followUpReady: 'Extends the chain · re-enters the queue',
  archive: 'Archive',
  archiveQuestion: 'Archive “{title}”? It leaves every list.',
  keepTask: 'Keep task',
  placementLabel: 'Place in queue',
  placementFirst: 'Front',
  placementLast: 'Back',
  appendAndQueue: 'Append & queue',
  cancel: 'Cancel',
  signedOff: 'Signed off',
  signedOffCount: '{n tasks} signed off',
  showAll: 'Show all {n}',
  showFewer: 'Show fewer',
} as const

export const taskView = {
  badgeRunning: 'running',
  badgeYourTurn: 'your turn',
  badgeToSignOff: 'to sign off',
  badgeQueue: 'queue',
  badgeBacklog: 'backlog',
  badgeDone: 'done',
  stepCounter: 'Step {n} of {m}',
  allDone: 'All {m} steps done',
  chain: 'Chain',
  events: 'Events',
  claimedBy: 'Claimed by',
  unclaimed: 'Unclaimed',
  asks: 'Asks',
  answer: 'Answer',
  stepDoneAt: 'Done · {time}',
  stepDone: 'Done',
  stepRunning: 'Running · {time}',
  stepWaiting: 'Waiting on you · {time}',
  stepNotStarted: 'Not started',
  openInFullScreen: 'Open in full screen',
  backToInline: 'Back to inline',
  backToBoard: 'Back to board',
} as const

/**
 * The labels of a BusyIndicator while a tool call runs.
 */
export const busy = {
  loadingBoard: 'Loading board…',
  loadingTask: 'Loading task…',
} as const

/**
 * The labels of a CopyButton: a task's display id, or every id in a list.
 */
export const copy = {
  copy: 'Copy',
  copied: 'Copied',
  copyAll: 'Copy all IDs',
  copiedAll: 'Copied all',
} as const

/**
 * The fold of a section with more cards than it shows at first.
 */
export const fold = {
  showAll: 'Show all {n}',
  showFewer: 'Show fewer',
} as const

/**
 * The fixed words of the time helpers. They are English whatever the
 * browser's locale. The numbers and units they compose are built by the
 * helpers themselves.
 */
export const times = {
  justNow: 'just now',
  ago: '{time} ago',
  none: '—',
  finishedToday: 'today {time}',
  finishedYesterday: 'yesterday',
  finishedThisYear: '{month} {day}',
  finishedEarlierYear: '{month} {day}, {year}',
  eventYesterday: 'Yesterday {time}',
  eventThisWeek: '{weekday} {time}',
  eventEarlier: '{month} {day} {time}',
  /** January first, in the order of `Date.prototype.getMonth`. */
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  /** Sunday first, in the order of `Date.prototype.getDay`. */
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const

/**
 * Strings that are heard, not seen: accessible names, hidden companion text
 * for characters that are not words, and screen reader announcements.
 */
export const assistive = {
  boardTitle: 'Board',
  close: 'Close',
  opensInNewTab: 'opens in a new tab',
  opensInBrowser: 'opens in your browser',
  none: 'none',
  landmarkMessages: 'Messages',
  pipSummaryIntro: '{n steps}: {parts}',
  pipDone: '{d} done',
  pipRunning: '{r} running',
  pipWaiting: '{w} waiting on you',
  pipNotStarted: '{p} not started',
  entryHint: 'Enter to add, Shift Enter to queue',
  moveDescription:
    'Press Enter to lift. Use the arrow keys to move. Press Enter to drop, or Escape to cancel.',
  moveLifted: '“{title}” lifted. Position {n} of {m}',
  moveMoved: 'Position {n} of {m}',
  moveDropped: '“{title}” dropped at position {n} of {m}',
  moveCancelled: 'Move cancelled. “{title}” is back at position {n} of {m}',
  moveLeftQueue: '“{title}” left the queue. Move ended',
  waitingOnYou: '“{title}” is waiting on you',
  sessionAsks: '{session} asks about “{title}”',
  questionForYou: '“{title}” has a question for you',
  waitingForSignOff: '“{title}” is finished and waiting for sign-off',
} as const

export const strings = {
  message,
  boardHeader,
  taskEntry,
  outputFormat,
  card,
  yourTurn,
  sessions,
  working,
  queue,
  backlog,
  done,
  taskView,
  busy,
  copy,
  fold,
  times,
  assistive,
} as const

/**
 * The names of the placeholders in a template, so `fillTemplate` can ask
 * for exactly those values.
 */
export type Placeholders<Template extends string> =
  Template extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never

/**
 * Replaces each `{name}` in a template with its value. A placeholder with no
 * value is left as written.
 */
export function fillTemplate<Template extends string>(
  template: Template,
  values: Record<Placeholders<Template>, string | number>
): string {
  const lookup: Record<string, string | number> = values
  return template.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    name in lookup ? String(lookup[name]) : placeholder
  )
}
