// The suggestions' copy (one strings module per feature, §4.11). Auto's title and detail are the
// server's, in the person's language; these are the frames the phone draws around them, in the
// app's English. Nothing here names a cost or a credit (D8). Start's refusals say the app's own
// words for each code, never the server's: its spend_ceiling sentence names the spend (D8).

import type { ProposedKind } from './schema';

export const SUGGESTION_COPY = Object.freeze({
  /** The card's eyebrow (§6.12.3). */
  eyebrow: 'Auto suggests',
  /** The one-line form's label while the keyboard is up. */
  lineLabel: 'Idea',
  start: 'Start',
  hide: 'Hide',
  /** VoiceOver: the actions name the suggestion. */
  startLabel: (title: string) => `Start: ${title}`,
  hideLabel: (title: string) => `Hide: ${title}`,
  cardLabel: (title: string, detail: string) =>
    detail ? `Auto suggests: ${title}. ${detail}` : `Auto suggests: ${title}`,
  /** VoiceOver's hint on Start: the Face ID step is announced (§6.12.5). */
  startHint: 'Asks for Face ID first, then starts it.',
  /** What Start makes, by proposed_action.kind (§6.12.3 "Start does: …"). */
  does: Object.freeze({
    board_task: 'Start does: files a ticket on the Board for it.',
    mission: 'Start does: plans a Mission for it. You approve the plan first.',
    playbook_run: 'Start does: runs the Playbook it names.',
    chat: 'Start does: opens a conversation with Auto about it.',
  }) satisfies Readonly<Record<ProposedKind, string>>,
  /** §6.12.3 'started': shown in place for 4 s. */
  started: 'Started. Auto is on it.',
  /** The header's count that opens the sheet: 'Ideas · 3'. */
  count: (count: number) => `Ideas · ${count}`,
  countLabel: (count: number) =>
    count === 1 ? "Auto's idea: 1 open. Opens it" : `Auto's ideas: ${count} open. Opens them all`,
  sheetTitle: "Auto's ideas",
  /** HUD's top bar. */
  hud: Object.freeze({
    next: '▸ NEXT',
    nextLabel: (title: string) => `Next: ${title}`,
    count: (count: number) => `IDEAS · ${count}`,
    start: 'START',
    hide: 'HIDE',
  }),
  /** Hide's reason menu (api/proactive.py HideReason); a cancel hides nothing. */
  reasons: Object.freeze({
    title: 'Hide this idea?',
    not_now: 'Not now',
    not_useful: 'Not useful',
    wrong_agent: 'Wrong agent',
    cancel: 'Cancel',
  }),
  /** Start refused: one line, and the suggestion stays put (§6.12.3 'refused'). */
  refused: Object.freeze({
    offline: "You're offline, so nothing was started.",
    expired: 'This idea has expired.',
    already_started: 'This idea was already started.',
    already_hidden: 'This idea was hidden, so it can’t be started.',
    not_available: 'This kind of idea can’t be started from the phone yet. Open it in Studio.',
    spend_ceiling: 'Auto can’t start new work right now. Ask your workspace owner.',
    other: 'Auto couldn’t start this. Try again in a minute.',
  }),
  hideFailed: 'Auto couldn’t hide this. Try again in a minute.',
});
