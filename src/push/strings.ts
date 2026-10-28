// The push wave's copy (PRD-001 §4.11: one strings.ts per feature). Honest copy (KP8,
// D-DATA-CLAIMS, D-NO-SIGNUP, D-NO-BILLING): no line names a status code, an internal id or a plan,
// says the work is resuming, or claims where data stays. Each story adds its own group here.

import { MAX_DEVICES_PER_PERSON } from './config';

/** What a push's link says when the record it names has moved on (KP9): one plain line each. */
export const PUSH_LINK_COPY = Object.freeze({
  questionGone: 'That question was already answered or closed.',
  ticketGone: 'That ticket is gone or in another workspace.',
  postGone: 'That post no longer needs you.',
  chatGone: 'That conversation is not available.',
  approvalGone: 'That approval was already decided.',
  missionGone: 'That Mission is gone or in another workspace.',
});

/**
 * What iOS draws on a notification (KP7): the buttons of each category, and the line it shows in
 * place of the text when previews are off. Every button opens the app; none approves anything.
 */
export const PUSH_CATEGORY_COPY = Object.freeze({
  reply: 'Reply…',
  replySend: 'Send',
  replyPlaceholder: 'Your answer',
  open: 'Open',
  questionPreview: 'A question needs your answer',
  openPreview: 'Automatos Go',
});

/** The Android channels' names, as the system's notification settings list them (KP20). */
export const PUSH_CHANNEL_COPY = Object.freeze({
  questions: 'Questions',
  review: 'Ready for review',
  auto: 'Auto',
});

/**
 * The phone's name when its model cannot be read (W2 US-009's name; Studio's Phones & devices shows
 * it). The model name itself comes from the phone.
 */
export const PUSH_PHONE_NAME_COPY = Object.freeze({
  ios: 'iPhone',
  android: 'Android phone',
});

/**
 * The preference lines the settings logic hands the Notifications screen (PRD-001 §4.7): who may
 * hide question text, and which phone's time the daily digest follows (W2 K12).
 */
export const PUSH_PREFS_COPY = Object.freeze({
  redactLocked: 'Your workspace owner or admin can change this.',
  digestPhone: 'With more than one phone, the digest follows the one you used last.',
});

/** Settings → Notifications (PRD-001 §4.7; the handoff §3, with D19, D22 and D24 over it). */
export const PUSH_SETTINGS_COPY = Object.freeze({
  back: 'Back',
  eyebrow: (workspace: string) => `Settings · ${workspace}`,
  title: 'Notifications',
  lede: 'Auto only taps you on the shoulder when work is waiting on you.',
  phoneSection: 'This phone',
  typesSection: 'What notifies you',
  typesScope: (workspace: string) => `For you in ${workspace}, on every phone you use.`,
  digestSection: 'Daily digest',
  digestLabel: 'Daily digest',
  digestDetail: "Auto's morning brief, as Auto's message in your Auto thread.",
  digestTimeLabel: 'Digest time',
  digestZone: (zone: string | null) =>
    zone
      ? `At this time in this phone's time zone (${zone}).`
      : "At this time in this phone's time zone.",
  digestNoRow: 'You can choose the time once notifications are on for this phone.',
  questionSection: 'Question text',
  redactLabel: 'Hide question text in notifications',
  redactDetail: 'Questions then say only that one is waiting, and open the app.',
  faceIdSection: 'Approvals and answers',
  loading: 'Reading your notification settings…',
  on: 'On',
  off: 'Off',
});

const minutesWord = (minutes: number) => (minutes === 1 ? '1 minute' : `${minutes} minutes`);

/**
 * Settings → Notifications → Daily digest: today's brief on request (digest_now). The 202's words
 * are a toast; a refusal or a failure is one plain line under the button; the wait after a 202 is
 * that line and part of the button's VoiceOver label.
 */
export const PUSH_DIGEST_NOW_COPY = Object.freeze({
  button: "Send today's brief now",
  queued: "On its way. It arrives in a minute as Auto's message, with a notification.",
  tryAgainIn: (minutes: number) => `Try again in ${minutesWord(minutes)}.`,
  tryAgainSoon: 'Try again in a few minutes.',
  unavailable: "Today's brief can't be sent right now. Try again later.",
  sentWait: (minutes: number) => `Sent. You can send another in ${minutesWord(minutes)}.`,
  waitLabel: (minutes: number) =>
    `Send today's brief now. You can send another in ${minutesWord(minutes)}.`,
});

/** The three push types' switches (D-TYPES): what each one covers, in the person's words. */
export const PUSH_TYPE_COPY = Object.freeze({
  needs_answer: Object.freeze({
    label: 'Needs an answer',
    detail: 'Questions, approvals and Mission plans waiting for you',
  }),
  review: Object.freeze({ label: 'Ready for review', detail: 'A ticket reaches Review' }),
  auto_message: Object.freeze({
    label: 'Auto messaged you',
    detail: 'Auto writes to you without being asked, and your daily digest',
  }),
});

/**
 * This phone's push state in one sentence each (US-014c's statuses; D21: an operator's 'No' is said
 * plainly), and the one button a state offers.
 */
export const PUSH_PHONE_COPY = Object.freeze({
  checking: 'Checking notifications on this phone…',
  ask: "This phone doesn't get notifications yet.",
  denied: "Notifications are off for Automatos Go in your phone's settings.",
  on: 'On for this phone.',
  offDeviceNotRegistered:
    'Expo reported that this phone no longer had the app, so notifications stopped.',
  offTokenMoved: 'Notifications moved to a newer sign-in on this phone.',
  offDeviceRevoked: "This phone was removed from your workspace's devices.",
  offOther: "Notifications aren't on for this phone yet.",
  revokedByAdmin:
    'A workspace owner or admin removed this phone in Studio. Ask them to add it back.',
  tokenElsewhere: 'Another account on this phone receives its notifications.',
  /** 409 device_limit_reached: the kit's words, never the server's; Try again sends once more. */
  deviceLimit: `This phone can't register for notifications: you already have ${MAX_DEVICES_PER_PERSON} devices registered in this workspace. Remove one in Studio → Settings → Phones & devices, then try again.`,
  keyMissingOwn: "This phone can't check its notifications. Pair it again to turn them on.",
  keyMissingHosted:
    "This phone can't check its notifications yet. Automatos Go tries again within a day.",
  notConfigured: "Notifications aren't set up in this build of Automatos Go yet.",
  unsupported: "This server doesn't send notifications to phones yet.",
  operatorOff: (server: string) =>
    `${server} doesn't send notifications to phones. Its operator can turn them on in Studio → Settings → Phones & devices; they are then sent through Expo's push service.`,
  turnOn: 'Turn on notifications',
  openSettings: 'Open Settings',
  turnOnAgain: 'Turn on again',
  tryAgain: 'Try again',
});

/**
 * What an action on a notification ends in (KP8): the server's own terms only. The answer route
 * cannot tell whether the work picked up again, so no line claims it.
 */
export const PUSH_ACTION_COPY = Object.freeze({
  answered: (ticket: string | null) => (ticket ? `Answered ${ticket}.` : 'Answered.'),
  alreadyAnswered: 'That question was already answered.',
  notSent: 'Not sent. Open the question to answer it.',
  unverified: "This notification couldn't be checked, so nothing was sent.",
  otherWorkspace: 'That notification is from another workspace.',
  answerHere: 'Answer it here.',
  /** A tap the phone could not check: its link is not followed, the inbox opens instead. */
  uncheckedTap:
    "This notification couldn't be checked on this phone, so here are your notifications.",
});

/**
 * The notifications inbox (Menu → Notifications): every bell notification, newest first, so none
 * is lost when its push is gone. Rows are buttons; the unread dot is said, never only drawn.
 */
export const PUSH_INBOX_COPY = Object.freeze({
  title: 'Notifications',
  back: 'Back',
  markAllRead: 'Mark all read',
  allRead: 'All marked read.',
  emptyTitle: 'Nothing yet',
  emptyMessage: 'When Auto has a message for you or needs you, it shows here.',
  unread: 'Unread',
  openHint: 'Opens what it is about',
  studioHint: 'Opens in Studio, in your browser',
  nothingToOpen: 'There is nothing more to open for this one.',
  studioFailed: "Studio couldn't be opened on this phone.",
  /** What the menu row and the button say, with the number VoiceOver hears. */
  menu: 'Notifications',
  unreadCount: Object.freeze({ one: 'unread', other: 'unread' }),
});

/**
 * The in-context ask (KP11): one title, the three push types in PUSH_TYPE_COPY's words, and two
 * buttons. 'Turn on' shows the phone's own permission prompt; nothing here promises more.
 */
export const PUSH_PROMPT_COPY = Object.freeze({
  title: 'Get a notification when Auto needs you',
  turnOn: 'Turn on',
  notNow: 'Not now',
});

const REMOVE_PHONE = 'Remove this phone';

/**
 * Settings → Account's push rows (US-014h, KP16, D63): the way to Notifications, and Remove this
 * phone on a hosted phone. It removes this phone from the workspace's devices and nothing else.
 */
export const PUSH_ACCOUNT_COPY = Object.freeze({
  notifications: 'Notifications',
  removePhone: REMOVE_PHONE,
  removeTitle: `${REMOVE_PHONE}?`,
  removeQuestion:
    "Remove this phone from your workspace's devices? Notifications stop here until you turn them on again. You stay signed in.",
  removeConfirm: REMOVE_PHONE,
  removeCancel: 'Cancel',
  removed: "This phone was removed from your workspace's devices.",
  removeFailed:
    "This phone couldn't be removed from your workspace's devices. Studio may still list this phone.",
});

/**
 * Settings → Notifications → Recent notification taps: what became of the last taps, in plain
 * words, so a tap that did not open what it should can be told apart from one that never arrived.
 */
export const PUSH_TAPS_COPY = Object.freeze({
  section: 'Recent notification taps',
  empty: 'No taps yet. Tap a notification and what happened shows here.',
  note: 'Kept on this phone only: what happened and when, never what a notification said.',
  outcome: Object.freeze({
    screen: 'Opened its screen',
    inbox: 'Opened Notifications',
    moved: 'It had moved on',
    answer: 'Answered from the notification',
    unverified: "Couldn't be checked",
    other_workspace: 'From another workspace',
    cannot_answer: 'Your role cannot answer here',
    blank_reply: 'The reply was empty',
    unknown: 'Opened Notifications',
    unreadable: "Couldn't be read",
    repeat: 'Already handled',
    navigate: "The screen didn't open",
    failed: 'Something went wrong',
  } as Readonly<Record<string, string>>),
  /** Why a notification could not be checked (the signature check's word). */
  check: Object.freeze({
    no_record: 'this phone holds no notification key',
    other_server: "the phone's key is another server's",
    keychain: "the phone's keychain was locked",
    no_key: 'this phone holds no notification key',
    stale: "it is over 7 days old, or the phone's clock is off",
    mismatch: "the phone's key does not match the server's",
    digest_failed: 'the check failed on this phone',
    not_v2: 'it is not an Automatos notification',
  } as Readonly<Record<string, string>>),
  /** The answer route's verdicts (answer.ts AnswerVerdictKind). */
  answer: Object.freeze({
    answered: 'Answer sent',
    already_answered: 'Already answered',
    refused: 'Answer refused',
    not_sent: 'Answer not sent',
  } as Readonly<Record<string, string>>),
  link: Object.freeze({
    question: 'Question',
    task: 'Ticket',
    chat: 'Chat',
    social_post: 'Social post',
    approval_grant: 'Approval',
    mission: 'Mission plan',
    other: 'Other link',
  } as Readonly<Record<string, string>>),
  noLink: 'No link',
});
