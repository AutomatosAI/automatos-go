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
  digestPhone:
    "In this phone's time zone. With more than one phone, the digest follows the one you used last.",
});
