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
  yourTurn: 'Waiting on user',
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
  ownerYou: 'User',
  agentChip: 'agent',
  youChip: 'user',
  detail: 'Detail',
  detailLabel: 'Detail of step {n}',
  detailPlaceholder: 'What whoever does this step needs to know',
  addStep: 'Add step',
  removeStep: 'Remove step {n}',
  chainPreview: 'Chain preview',
  chainNote: '{n steps} · {h} for the user',
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
 * How a card names each output format. The same as the server's
 * (shared/output_format.ts, which components may not import).
 */
export const outputFormat = {
  shown: {
    pull_request: 'Pull request',
    ticket: 'Ticket',
    document: 'Document',
    link: 'Link',
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
  title: 'Waiting on user',
  nothingWaiting: 'Nothing waiting on the user',
  kindYourStep: 'User step',
  kindQuestion: 'Asks',
  asks: '{session} asks',
  stepCounter: 'Step {n}/{m}',
  cardCounter: 'Step {n}/{m} · {waited}',
  markDone: 'Mark done',
  noteLabel: 'Note',
  notePlaceholder: 'Add a note for the next step',
  answerLabel: 'Answer to the agent',
  answerPlaceholder: 'What the agent needs to know',
  answer: 'Answer',
  needsAnswer: 'An answer needs some text',
  answerReady: '{session} resumes with this',
  answerReadyUnnamed: 'The session resumes with this',
  park: 'Park',
  parkQuestion: 'Park “{title}”? It moves to the backlog and its step is released.',
  keepStep: 'Keep step',
  input: '{format} from step {n} ↗',
  kindBlocked: 'Blocked',
  blockedStep: 'Step {n} · {step title}',
  blockedFor: 'Blocked {waited}',
  unblockIn: 'Unblock it in {session}’s session',
  unblockInUnnamed: 'Unblock it in the worker’s session',
} as const

/**
 * The form an agent asks the user with, page by page, on a Waiting on user
 * card.
 */
export const questionForm = {
  progress: 'Question {n} of {m}',
  progressUpTo: 'Question {n} of up to {m}',
  pickOne: 'Pick one',
  pickMany: 'Pick one or more',
  typeAnswer: 'Type an answer',
  textPlaceholder: 'What the agent needs to know',
  next: 'Next',
  back: 'Back',
  answer: 'Answer',
  answerDirectly: 'Answer directly',
  backToForm: 'Back to the form',
} as const

/**
 * Rejecting the agent step whose output waits on the user, on a Waiting on
 * user card or a Done card.
 */
export const reject = {
  reject: 'Reject',
  label: 'What was wrong',
  placeholder: 'What the agent should change',
  needsNote: 'A rejection needs a note',
  redoes: 'The agent redoes its step with this',
  sendBack: 'Send back',
  cancel: 'Cancel',
} as const

export const sessions = {
  idleTitle: 'Idle',
  session: 'Session',
  thisChat: 'This chat',
  kindWorker: 'Worker',
  claimedBy: 'Claimed by',
  unclaimed: 'Unclaimed',
  idle: 'Idle',
  running: 'Running',
  waitingOnYou: 'Waiting on user',
  holding: 'Step {n} of {m} · {step title}',
  holdingStep: 'Step {n} · {step title}',
  blockedOn: 'Blocked on {id} step {n}',
  ended: 'Ended {when}',
  released: 'Released',
  releasedTasks: 'Released {n tasks}',
  nothingIdle: 'No session is idle',
  remove: 'Remove',
  removeQuestion: 'Remove {name}? Its step on {id} goes back to the queue.',
  keepWorker: 'Keep worker',
  stopAndRemove: 'Stop and Remove',
  stopQuestion: 'Stop and remove {name}? Its step on {id} goes back to the queue.',
} as const

export const working = {
  title: 'Working',
  nothingWorking: 'Nothing is running',
  elapsed: '{elapsed} elapsed',
  latestNote: 'Latest note',
  produces: 'Produces a {format}',
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
  yourTime: 'user {time}',
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
  showHistory: 'Show all completed tasks',
} as const

/**
 * The History view: the completed tasks, a page at a time.
 */
export const history = {
  title: 'History',
  summary: '{n completed tasks}',
  filterLabel: 'Filter',
  filterPlaceholder: 'Title or ID',
  columnTask: 'Task',
  columnSteps: 'Steps',
  columnTimes: 'Agent / User',
  columnWorkers: 'Workers',
  columnArtifacts: 'Artifacts',
  columnSignedOff: 'Signed off',
  steps: '{n steps}',
  times: '{agent} / {user}',
  noneCell: '—',
  page: 'Page {n} of {m}',
  previous: '← Previous',
  next: 'Next →',
  emptyYet: 'No completed tasks yet',
  emptyMatch: 'No completed tasks match',
  backToBoard: 'Back to board',
  backToHistory: 'Back to history',
} as const

export const taskView = {
  badgeRunning: 'running',
  badgeYourTurn: 'waiting on user',
  badgeToSignOff: 'to sign off',
  badgeQueue: 'queue',
  badgeBacklog: 'backlog',
  badgeDone: 'done',
  stepCounter: 'Step {n} of {m}',
  allDone: 'All {m} steps done',
  oneDone: '1 step done',
  meta: '{a agent steps} · {h} for the user',
  agentTime: 'agent {time}',
  userTime: 'user {time}',
  chain: 'Chain',
  handoffChain: 'Handoff chain',
  expandHint: 'click a step to expand',
  events: 'Events',
  claimedBy: 'Claimed by',
  unclaimed: 'Unclaimed',
  detail: 'Detail',
  asks: 'Asks',
  answer: 'Answer',
  blocked: 'Blocked',
  latestNote: 'Latest note',
  summary: 'Summary',
  links: 'Links',
  input: 'Input',
  output: 'Output',
  stepDoneAt: 'Done · {time}',
  stepDone: 'Done',
  stepRunning: 'Running · {time}',
  stepWaiting: 'Waiting on user · {time}',
  stepBlocked: 'Blocked · {time}',
  stepNotStarted: 'Not started',
  openInFullScreen: 'Open in full screen',
  backToInline: 'Back to inline',
  backToBoard: 'Back to board',
  park: 'Park',
  parkQuestion: 'Park “{title}”? Its claim is cleared and it moves to the backlog.',
  keepStep: 'Keep step',
  archive: 'Archive',
  archiveQuestion: 'Archive “{title}”? It is taken off every list.',
  keepTask: 'Keep task',
  clone: 'Clone task',
} as const

/**
 * The task view's event log: a word for each kind of event, and who caused it.
 */
export const events = {
  kinds: {
    added: 'Added',
    queued: 'Queued',
    reordered: 'Reordered',
    claimed: 'Claimed',
    started: 'Started',
    noted: 'Noted',
    asked: 'Asked',
    answered: 'Answered',
    completed: 'Completed',
    parked: 'Parked',
    released: 'Released',
    signed_off: 'Signed off',
    followed_up: 'Followed up',
    archived: 'Archived',
    assigned: 'Assigned',
    unassigned: 'Unassigned',
    blocked: 'Blocked',
    unblocked: 'Unblocked',
    removed: 'Removed',
    rejected: 'Rejected',
  },
  step: 'step {n}',
  byUser: 'user',
} as const

/**
 * The labels of a BusyIndicator while a tool call runs.
 */
export const busy = {
  loadingBoard: 'Loading board…',
  loadingTask: 'Loading task…',
  loadingHistory: 'Loading history…',
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
  signedOffThisYear: '{day} {month}, {time}',
  signedOffEarlierYear: '{day} {month} {year}, {time}',
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
  opensInBrowser: 'opens in the browser',
  none: 'none',
  landmarkMessages: 'Messages',
  landmarkPages: 'Pages',
  pipSummaryIntro: '{n steps}: {parts}',
  pipDone: '{d} done',
  pipRunning: '{r} running',
  pipWaiting: '{w} waiting on the user',
  pipNotStarted: '{p} not started',
  entryHint: 'Enter to add, Shift Enter to queue',
  moveDescription:
    'Press Enter to lift. Use the arrow keys to move. Press Enter to drop, or Escape to cancel.',
  moveLifted: '“{title}” lifted. Position {n} of {m}',
  moveMoved: 'Position {n} of {m}',
  moveDropped: '“{title}” dropped at position {n} of {m}',
  moveCancelled: 'Move cancelled. “{title}” is back at position {n} of {m}',
  moveLeftQueue: '“{title}” left the queue. Move ended',
  waitingOnYou: '“{title}” is waiting on the user',
  sessionAsks: '{session} asks about “{title}”',
  questionForYou: '“{title}” has a question for the user',
  waitingForSignOff: '“{title}” is finished and waiting for sign-off',
  blockedIn: '{id} is blocked in {session}',
  blockedUnnamed: '{id} is blocked',
} as const

export const strings = {
  message,
  boardHeader,
  taskEntry,
  outputFormat,
  card,
  yourTurn,
  questionForm,
  reject,
  sessions,
  working,
  queue,
  backlog,
  done,
  history,
  taskView,
  events,
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
