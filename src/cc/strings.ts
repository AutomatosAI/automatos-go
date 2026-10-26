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

/** The Calendar (handoff §2 'Calendar', D27). Kind words are the vendored calendar-kinds.ts. */
export const CALENDAR_COPY = Object.freeze({
  /** An item the server sent without a name. */
  untitled: 'Untitled',
  /** A kind the server sent blank: it is still listed, under this word. */
  otherKind: 'Scheduled',
  /** A deadline whose time has passed (the server keeps a missed SLA in the feed). */
  overdue: 'Overdue',
  /** Between the agent and the cadence: 'Ledger · weekdays'. */
  separator: '·',
  /** How often it runs, lower case after the agent: 'Relay · Inbox triage · every 15 min'. */
  cadence: Object.freeze({
    oneOff: 'one-off',
    recurring: 'recurring',
    hourly: 'hourly',
    daily: 'daily',
    weekdays: 'weekdays',
    weekends: 'weekends',
    minutes: (count: number) => `every ${count} min`,
    hours: (count: number) => `every ${count} h`,
    days: (count: number) => `every ${count} days`,
  }),
  loading: 'Loading the calendar…',
  stripLabel: 'Choose a day',
  today: 'today',
  /** A strip cell's figure, said after its date: 'Fri 23 Oct, 3 items'. */
  items: Object.freeze({ one: 'item', other: 'items' }),
  nothingOn: 'nothing scheduled',
  /** The always-on band (handoff §2): heartbeats every hour or faster, every day. */
  bandMark: '24/7',
  bandLabel: 'Always on',
  /** An item the server sent no time for; VoiceOver hears the words. */
  noTime: '—',
  noTimeSaid: 'no set time',
  /** A word beside the kind on a greyed row (every colour status has a word, §4.6). */
  paused: 'Paused',
  /** An overdue deadline listed today: 'Due Tue 20 Oct'. */
  dueOn: (date: string) => `Due ${date}`,
  empty: 'Nothing scheduled this day.',
  /** What a row or a band line opens, said after its own label. */
  openHint: 'Opens the item',
  /** The item sheet (handoff §2 'Calendar' tap → sheet, D27). */
  sheet: Object.freeze({
    everyDay: 'Every day',
    pause: Object.freeze({ routine: 'Pause this routine', task: 'Pause this task' }),
    resume: Object.freeze({ routine: 'Resume this routine', task: 'Resume this task' }),
    effect: Object.freeze({
      routine: 'Pausing stops this routine’s heartbeat until it is resumed.',
      task: 'Pausing holds this task’s runs until it is resumed.',
      resume: 'Resuming starts its runs again on its schedule.',
    }),
    /**
     * What pausing does to the feed: a routine leaves it (activity_service.py lists enabled
     * heartbeats only; Studio resumes it on the agent's Heartbeat tab); a scheduled task stays with
     * paused: true (activity_scheduled_task_items.py), so its sheet offers Resume.
     */
    pausedFeed: Object.freeze({
      routine:
        'A paused routine leaves this calendar. Resume it in Studio, on its agent’s Heartbeat tab.',
      task: 'It stays on this calendar, marked Paused, so you can resume it here.',
    }),
    paused: (title: string) => `Paused. “${title}” will not run until it is resumed.`,
    resumed: (title: string) => `Resumed. “${title}” runs on its schedule again.`,
    /** D-ROLES: a viewer reads the item and is told who pauses it. */
    readOnly: 'Owners, admins and editors pause and resume routines and scheduled tasks.',
    /** D27: every kind but a routine and a scheduled task is managed in Studio. */
    studio: 'Manage in Studio',
    studioHint: 'Opens Studio in the browser',
    studioMissing: 'Manage this in Studio on the web.',
    studioFailed: 'Studio could not be opened on this phone.',
    onBoard: (number: string) => `Open ${number} on the board`,
    onBoardUnnumbered: 'Open the ticket on the board',
    onBoardHint: 'Opens the ticket on the Board',
  }),
});

/** The ticket sheet (handoff §2 'ticket sheet', D-BOARD, D31). */
export const TICKET_COPY = Object.freeze({
  loading: 'Loading the ticket…',
  /** 'Ledger · updated 08:06'. */
  updated: 'updated',
  yesterday: 'Yesterday',
  /** The box on a ticket blocked on a question: it opens Questions, where it is answered. */
  question: Object.freeze({
    title: 'Waiting for your answer',
    link: 'Answer in Questions',
    hint: 'Opens Questions',
  }),
  /** What the agent handed in, and why a failed ticket failed: plain text, cut at a length. */
  result: 'Result',
  failure: 'Why it failed',
  cut: '…',
  deliverables: 'Deliverables',
  /** A Deliverable row: open it (D25: never Review, Approve or Request changes). */
  open: 'Open',
  openHint: 'Opens the Deliverable',
  /** The Approve button names what approving does (the web's approval-effect.ts). */
  approve: Object.freeze({
    done: 'Approve and mark done',
    publish: 'Approve and publish',
    startPost: 'Approve and start the post',
    plan: 'Approve the plan',
  }),
  effect: Object.freeze({
    done: 'Approving marks the ticket done. Nothing else runs.',
    publish: 'Approving publishes the blog post to the live site.',
    startPost: 'Approving starts the blog post.',
    startPostOn: (topic: string) => `Approving starts a blog post on “${topic}”.`,
    plan: 'Approving starts the mission with this plan.',
  }),
  approved: Object.freeze({
    done: (ticket: string) => `Approved. ${ticket} is done.`,
    published: 'Approved. The post is published.',
    publishedTitle: (title: string) => `Approved. “${title}” is published.`,
    started: 'Approved. The blog post has started.',
    startedOn: (topic: string) => `Approved. The blog post on “${topic}” has started.`,
  }),
  sendBack: 'Send back',
  cancel: 'Cancel',
  /** The Send back note: the agent reads it first (PRD-252 R2). */
  note: Object.freeze({
    label: 'What’s wrong?',
    placeholder: 'Say what to fix. The agent reads this first.',
    helper: 'The ticket goes back to its agent, and the redo starts from your words.',
  }),
  sentBack: (agent: string) => `Sent back to ${agent}. The redo starts from your note.`,
  theAgent: 'the agent',
  /** D-ROLES: a viewer reads a ticket in Review and is told who decides it. */
  readOnly: 'Owners, admins and editors approve or send back tickets.',
  /** D31: a new conversation with the ticket as its context (the chat wave renders it). */
  askAbout: (number: string) => `Ask Auto about ${number}`,
  askAboutThis: 'Ask Auto about this ticket',
  askHint: 'Opens a chat with Auto about this ticket',
  /** After DISCUSS_AFTER_REJECTS send-backs (the web's discuss hint). */
  sentBackTimes: (times: number) =>
    `Sent back ${times} times. Talking it through with Auto may be quicker.`,
});

/** Questions (handoff §2 'Questions', D-QUESTIONS, D16, D17). */
export const QUESTIONS_COPY = Object.freeze({
  loading: 'Loading the questions…',
  listLabel: 'Open questions',
  empty: Object.freeze({
    title: 'No open questions',
    message: 'Agents are deciding on their own.',
  }),
  /** A 403 on the list (owners and admins only until PRD-266 W1): the taxonomy's words follow. */
  forbiddenTitle: 'Questions are not open to you here',
  /** What a ticket link opens, said after its own label. */
  ticketHint: 'Opens the ticket',
  /** 'Blocking 2 downstream tasks', then up to six of them and '+3 more'. */
  blocking: Object.freeze({ one: 'downstream task', other: 'downstream tasks' }),
  blockingWord: 'Blocking',
  more: (count: number) => `+${count} more`,
  untitled: 'Untitled',
  /** Shown when the question offers options; with none, the field is always open. */
  ownWords: 'Answer in your own words instead',
  hideOwnWords: 'Hide',
  field: Object.freeze({ label: 'Your answer', placeholder: 'Answer…' }),
  answer: 'Answer',
  answerHint: 'Sends your answer to the agent',
  optionHint: 'Sends this answer to the agent',
  /** Refused before sending: the words are the user's to fix. */
  answerEmpty: 'Write an answer before you send it.',
  notOffered: 'Choose one of the answers the agent offered.',
  dismiss: 'Dismiss',
  keep: 'Keep the question',
  /** What a dismiss does (api/approval_grants.py deny_approval), said before it is sent. */
  dismissEffect: Object.freeze({
    blocked:
      'Dismissing leaves the ticket blocked, and the agent may ask again. To unblock it, answer “use your judgment” instead.',
    stoppedRun:
      'This question stopped a playbook run. Dismissing closes that run: it is cancelled and its card moves to Done.',
  }),
  /** The server's result, honestly: the answer route cannot tell whether the agent resumed. */
  answered: 'Answered.',
  alreadyAnswered: 'This question was already answered.',
  alreadyDismissed: 'This question was already dismissed.',
  dismissed: Object.freeze({
    blocked: 'Dismissed. The ticket stays blocked, and the agent may ask again.',
    stoppedRun: 'Dismissed. The run that stopped to ask is closed.',
  }),
  /** D-ROLES: a viewer reads the questions and is told who answers them. */
  readOnly: 'Owners, admins and editors answer questions.',
});

/** A social post awaiting approval (D-SOCIAL, D45): the words the web's approval view uses. */
export const SOCIAL_COPY = Object.freeze({
  loading: 'Loading the post…',
  untitled: 'Untitled post',
  /** modules/socials SOCIAL_POST_STATUSES, as the web's socials-status.ts names them. */
  status: Object.freeze({
    draft: 'Draft',
    rendering: 'Rendering',
    needs_approval: 'Needs approval',
    changes_requested: 'Changes requested',
    approved: 'Approved',
    scheduled: 'Scheduled',
    publishing: 'Publishing',
    published: 'Published',
    partially_published: 'Partially published',
    failed: 'Failed',
    missed: 'Missed',
    archived: 'Archived',
  } as Readonly<Record<string, string>>),
  format: Object.freeze({
    video: 'Video',
    image: 'Image',
    carousel: 'Carousel',
    fact_card: 'Fact card',
    infographic: 'Infographic',
    text: 'Text',
  } as Readonly<Record<string, string>>),
  /** The seeded channels (channel_adapters.py labels); another toolkit is named from its slug. */
  channels: Object.freeze({
    linkedin: 'LinkedIn',
    twitter: 'X',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
  } as Readonly<Record<string, string>>),
  /** F256: with no channel nothing would post, so Approve waits for one. */
  noChannel: 'Nothing would post: no channel is chosen. Add one in Studio, then approve it.',
  publishes: (when: string) => `Publishes ${when}`,
  planned: (when: string) => `Planned for ${when}`,
  notScheduled: 'Not scheduled yet',
  media: 'Media',
  mediaFailed: 'This file could not be loaded.',
  mediaLoading: 'Loading the file…',
  /** A media entry with no file name (a Deliverable id an edit set) is not served by the post. */
  elsewhere: Object.freeze({ one: 'more file is in Studio', other: 'more files are in Studio' }),
  video: (name: string) => `Video ${name}`,
  image: (name: string) => `Image ${name}`,
  approve: 'Approve',
  requestChanges: 'Request changes',
  send: 'Send request',
  cancel: 'Cancel',
  /** What approving does: it binds this exact version (D6). */
  effect: Object.freeze({
    slot: (when: string) => `Approving schedules this exact version for ${when}.`,
    noSlot: 'Approving locks this exact version. It publishes once it is scheduled.',
  }),
  comment: Object.freeze({
    label: 'What needs to change?',
    placeholder: 'Say what to change. This goes on the post.',
    helper: 'The post goes back for changes with your comment.',
  }),
  commentRequired: 'Say what needs to change before you send it.',
  commentTooLong: (max: number) => `Keep the comment under ${max} characters.`,
  approved: 'Approved.',
  approvedScheduled: 'Approved and scheduled.',
  changesRequested: 'Changes requested. Your comment is on the post.',
  /** A 409 on Approve: the post was reloaded, and this is the version now on screen. */
  changed:
    'This post changed while you were reviewing it. The new version is on screen: review it, then approve.',
  /** D-ROLES: a viewer reads the post and is told who decides it. */
  readOnly: 'Owners, admins and editors approve social posts.',
  notAwaiting: (status: string) => `This post is ${status.toLowerCase()}: nothing waits on you.`,
  studio: 'Open in Studio',
  studioHint: 'Opens the post in Studio in the browser',
  studioMissing: 'Open this post in Studio on the web.',
  studioFailed: 'Studio could not be opened on this phone.',
});

/** The Deliverables gallery (D-DELIVERABLES, D25): what agents made, opened and never decided. */
export const DELIVERABLES_COPY = Object.freeze({
  loading: 'Loading the Deliverables…',
  listLabel: 'Deliverables',
  filtersLabel: 'Filter the Deliverables by type',
  /** The filter that shows every type. */
  all: 'All',
  /** A Deliverable the server sent without a title. */
  untitled: 'Untitled',
  /** A type the server sent blank: the card still shows, under this word. */
  file: 'File',
  /** The web's artwork labels (deliverable-icon.tsx), one for the card and many for the filter. */
  types: Object.freeze({
    report: Object.freeze({ one: 'Report', other: 'Reports' }),
    image: Object.freeze({ one: 'Image', other: 'Images' }),
    document: Object.freeze({ one: 'Document', other: 'Documents' }),
    code: Object.freeze({ one: 'Code', other: 'Code' }),
    slide: Object.freeze({ one: 'Slides', other: 'Slides' }),
    spreadsheet: Object.freeze({ one: 'Spreadsheet', other: 'Spreadsheets' }),
    blog_post: Object.freeze({ one: 'Blog post', other: 'Blog posts' }),
    video: Object.freeze({ one: 'Video', other: 'Videos' }),
    audio: Object.freeze({ one: 'Audio', other: 'Audio' }),
    archive: Object.freeze({ one: 'Archive', other: 'Archives' }),
  }),
  /** Who made it when no agent did: where it came from (the web's made-by.ts). */
  madeBy: Object.freeze({
    social_post: 'Socials',
    upload: 'Uploaded',
    mission: 'Mission',
    playbook: 'Playbook',
    heartbeat: 'Routine',
    task: 'Task',
    chat: 'Chat',
    agent_output: 'Generated',
    document: 'Templates',
    trigger: 'Trigger',
  } as Readonly<Record<string, string>>),
  unknownAgent: 'Unknown agent',
  /** Between who made it and when: 'Scout · 08:06'. */
  separator: '·',
  /** A failed run's report (deliverable_service.py shown_status): a word beside the dot. */
  failedRun: 'Run failed',
  /** What a card opens, said after its own label. */
  openHint: 'Opens the Deliverable',
  loadMore: 'Load more',
  loadMoreHint: 'Shows older Deliverables',
  empty: Object.freeze({
    title: 'No Deliverables yet',
    message: 'Files your agents write land here.',
  }),
  emptyType: (types: string) => `No ${types.toLowerCase()} yet`,
  emptyTypeMessage: 'Files of this type land here as your agents write them.',
});

/** One Deliverable's page (US-013b, D25): read, opened or reported; never approved. */
export const DELIVERABLE_COPY = Object.freeze({
  loading: 'Loading the Deliverable…',
  back: 'Deliverables',
  backLabel: 'Back to the Deliverables',
  summary: 'Summary',
  /** content_truncated: the server sends a file's first megabyte inline. */
  truncated: 'This is the first part of the file. Studio has all of it.',
  open: Object.freeze({
    pdf: 'Open the PDF',
    docx: 'Open the document',
    xlsx: 'Open the spreadsheet',
  }),
  openHint: "Downloads the file and shows it in the phone's viewer",
  viewerFailed: 'This file could not be opened on this phone.',
  image: (title: string) => `Image: ${title}`,
  imageFailed: 'This image could not be loaded.',
  notShown: 'The phone cannot show this file. Studio can.',
  unreadable: 'The workspace could not read this file. Try it in Studio.',
  noFile: 'This Deliverable has no file the phone can open.',
  emptyFile: 'Nothing is written in this file yet.',
  studio: 'Open in Studio',
  studioHint: 'Opens the Deliverable in Studio in the browser',
  studioMissing: 'Open this Deliverable in Studio on the web.',
  studioFailed: 'Studio could not be opened on this phone.',
});
