// The Command Centre's copy (PRD-001 §4.11: one strings.ts per feature). Status words are the web's
// own (STATUS_CONFIG) and reason chips the vendored ticket-stage.ts; this file holds the words the
// app adds. Nothing about billing (D8; the gate reads this file's added lines for it).

export const BOARD_COPY = Object.freeze({
  /** The filter that shows every ticket. */
  all: 'All',
  /** A ticket the server sent without a title. */
  untitled: 'Untitled',
  /** Send back with no note: the server needs words to lead the redo (PRD-252 R2). */
  feedbackRequired: 'Say what to change before you send it back.',
  /** Longer than the server keeps (MAX_REVIEW_FEEDBACK_CHARS): it would be cut off silently. */
  feedbackTooLong: (max: number) => `Keep the note under ${max} characters.`,
  /** A ticket no agent of this workspace holds (the web's word). */
  unassigned: 'Unassigned',
  /** Between the kind and a raised priority on a card's kind row: 'MISSION · HIGH'. */
  separator: '·',
  filtersLabel: 'Filter the board by status',
  listLabel: 'Tickets',
  loading: 'Loading the board…',
  /** What a card opens, said after its own label. */
  openHint: 'Opens the ticket',
  /** An empty filter: the column's word in the title, a line on what would be there. */
  emptyAll: Object.freeze({
    title: 'Nothing on the board',
    message: 'Tickets show here when you or Auto file work.',
  }),
  emptyTitle: (word: string) => `Nothing in ${word}`,
  emptyMessages: Object.freeze({
    inbox: 'No ticket is waiting to be picked up.',
    assigned: 'No ticket is waiting for its agent to start.',
    in_progress: 'No agent is working on a ticket right now.',
    review: 'Nothing is waiting for your verdict.',
    blocked: 'Nothing is held up.',
    done: 'No ticket has finished yet.',
    failed: 'No ticket has failed.',
    cancelled: 'No ticket was cancelled or closed.',
  }),
  /** A status this version does not know, once its last ticket has moved on. */
  emptyOther: 'No ticket has this status now.',
});

/** The Command Centre's frame (handoff §2): the top bar, the head and the tabs. */
export const SHELL_COPY = Object.freeze({
  /** iOS shows the word beside the chevron; Android the arrow alone (handoff §Frame). */
  back: 'Auto',
  backLabel: 'Back to Auto',
  eyebrow: 'Operations',
  title: 'Command Centre',
  /** The stream's state, a word beside the dot (every colour status has a word, §4.6). */
  live: Object.freeze({ live: 'Streaming live', connecting: 'Connecting', offline: 'Offline' }),
  tabsLabel: 'Command Centre sections',
  tabs: Object.freeze({
    board: 'Board',
    calendar: 'Calendar',
    questions: 'Questions',
    deliverables: 'Deliverables',
  }),
  /** The lede: '1 agent working, 5 in queue, 6 need your eyes.' */
  agents: Object.freeze({ one: 'agent working', other: 'agents working' }),
  inQueue: 'in queue',
  needs: Object.freeze({ one: 'needs your eyes', other: 'need your eyes' }),
  nothingNeeds: 'nothing needs your eyes',
  /** The eyebrow's date, English in v1 (Sunday first, as Date.getDay counts). */
  weekdays: Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
  months: Object.freeze([
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]),
});
