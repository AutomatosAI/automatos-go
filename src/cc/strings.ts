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
});
