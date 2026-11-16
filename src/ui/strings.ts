// User-facing copy for the shared primitives (one strings module per feature). The words an error
// shows come from src/api/strings.ts through userMessage(); these are the frames around them.

import type { ReportReason, ReportTargetType } from '../api/reports';
import type { ServerSource } from '../api/server';

export const UI_COPY = Object.freeze({
  loading: 'Loading…',
  errorTitle: 'Something went wrong',
  retry: 'Try again',
  /** The word beside the live dot (every colour status also has a word, §4.6). */
  live: 'Live',
  /** The sheet's backdrop, for TalkBack (VoiceOver closes a sheet with the escape gesture). */
  closeSheet: 'Close',
  /** The Header's way back, for VoiceOver (the button shows a chevron only). */
  back: 'Back',
  /**
   * The Command Centre's name: the header menu's row (D73) and HUD's button (the web's
   * "Command Center", D-terms).
   */
  commandCentre: 'Command Centre',
  /** What the button's badge counts, for VoiceOver: '1 needs you', '6 need you'. */
  needYou: Object.freeze({ one: 'needs you', other: 'need you' }),
  /** A switch's state in a word beside it (§4.6: never only a colour). */
  switchOn: 'On',
  switchOff: 'Off',
});

export type ReportReasonChoice = { readonly id: ReportReason; readonly label: string };

/**
 * "Report this" reasons (D15). The ids are EXACTLY the server's REPORT_REASONS (PRD-266 W3
 * US-016a; lead, 20 Oct) and are what the payload sends; the labels are the words on screen.
 */
export const REPORT_REASON_CHOICES: readonly ReportReasonChoice[] = Object.freeze([
  { id: 'harmful', label: 'Harmful or dangerous' },
  { id: 'offensive', label: 'Offensive or hateful' },
  { id: 'inaccurate', label: 'Wrong or misleading' },
  { id: 'privacy', label: 'Shares private information' },
  { id: 'other', label: 'Something else' },
]);

export const REPORT_COPY = Object.freeze({
  /** The action on an Auto message or a Deliverable that opens the sheet. */
  action: 'Report this',
  titles: Object.freeze({
    message: 'Report this message',
    deliverable: 'Report this Deliverable',
  } satisfies Record<ReportTargetType, string>),
  /**
   * Who sees the report, by the server it goes to (report.ts reportIntro, from the client's
   * server): on the hosted server Automatos's moderation team too (docs/release/privacy-facts.md
   * 'Report this').
   */
  intro: Object.freeze({
    hosted: 'Your workspace owner and the Automatos moderation team will see this report.',
    own: 'Your workspace owner will see this report.',
  } satisfies Record<ServerSource, string>),
  reasonLabel: 'What is wrong with it?',
  noteLabel: 'Anything else (optional)',
  notePlaceholder: 'Add a short note',
  send: 'Send report',
  cancel: 'Cancel',
  sent: 'Thanks. Your report was sent.',
  alreadySent: 'You already reported this. Thanks.',
});
