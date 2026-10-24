// The push wave's copy (PRD-001 §4.11: one strings.ts per feature). Honest copy (KP8,
// D-DATA-CLAIMS, D-NO-SIGNUP, D-NO-BILLING): no line names a status code, an internal id or a plan,
// says the work is resuming, or claims where data stays. Each story adds its own group here.

/** What a push's link says when the record it names has moved on (KP9): one plain line each. */
export const PUSH_LINK_COPY = Object.freeze({
  questionGone: 'That question was already answered or closed.',
  ticketGone: 'That ticket is gone or in another workspace.',
  postGone: 'That post no longer needs you.',
  chatGone: 'That conversation is not available.',
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
