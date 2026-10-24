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
