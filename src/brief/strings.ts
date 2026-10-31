// The brief's copy (one strings module per feature, §4.11). What Auto says is the server's, in the
// person's language (PRD-268 §6.11: the greeting, Auto's Read, each row's title, why and action
// label); these are the frames the phone draws around it. Brief@1 carries no section labels or
// empty sentence (the W2 kit's US-C19c model), so the card's own are here, in the app's English
// as every other frame is; the status words are the vocabulary's (src/styles/strings.ts).

import type { BriefSectionName } from './schema';

export const BRIEF_COPY = Object.freeze({
  /** The card's eyebrow after the date: 'Tuesday, 28 October · your brief'. */
  eyebrow: (date: string) => `${date} · your brief`,
  dateLabel: (weekday: string, day: number, month: string) => `${weekday}, ${day} ${month}`,
  weekdays: Object.freeze([
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]) as readonly string[],
  months: Object.freeze([
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]) as readonly string[],
  sections: Object.freeze({
    needs_you: 'Needs you',
    suggestions: 'Ideas',
    today: 'Today',
    since: 'Since your last brief',
    unchecked: "Couldn't check",
  }) satisfies Readonly<Record<BriefSectionName, string>>,
  /** A brief with no rows in any section (§6.11.2). */
  empty: 'Nothing new needs you, and nothing is scheduled today.',
  /** The fold: 'Show 2 more'. */
  showMore: (count: number) => `Show ${count} more`,
  showMoreLabel: (count: number, section: string) => `Show ${count} more in ${section}`,
  /** A row pressed: its done words in place ('✓ Started'). */
  done: (label: string) => `✓ ${label}`,
  /** The action's arrow after its words: 'Start →'. */
  action: (label: string) => `${label} →`,
  /** VoiceOver's hint on an action that opens Studio in the browser. */
  opensStudio: 'Opens in Studio, in your browser',
  /** Listen (§6.4 'Spoken'): never plays until pressed; a second press stops it. */
  listen: Object.freeze({
    label: 'Listen',
    accessibilityLabel: 'Listen to the brief',
    stop: 'Stop',
    stopLabel: 'Stop reading the brief',
  }),
  /** HUD: the transcript's button and the sheet's head. */
  hud: Object.freeze({
    open: 'OPEN BRIEF',
    openLabel: "Open today's brief",
    head: (date: string) => `Briefing · ${date}`,
    action: (label: string) => `▸ ${label}`,
  }),
});
