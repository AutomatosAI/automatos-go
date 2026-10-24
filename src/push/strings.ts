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
