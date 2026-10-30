// "What Auto depends on" in words (PRD-268 §6.11.3, §6.12.3 'Readiness list', US-G07). The server's
// items arrive with their label, detail and fix written by the server in the person's language;
// these are the section's own words and the rows the app adds for this phone (push, microphone,
// speech recognition and the server voice), which the server never claims. Where push or voice
// already says a thing (src/push/strings.ts, src/voice/strings.ts), the row says it in their words.

import type { ReadinessState } from './schema';

export const READINESS_COPY = Object.freeze({
  title: 'What Auto depends on',
  /** '4 of 6 ready', beside the title. */
  readyCount: (ready: number, total: number) => `${ready} of ${total} ready`,
  checkAgain: 'Check again',
  checkAgainHint: 'Checks everything Auto depends on now.',
  /** The server's items are being read (the first read, or Check again). */
  checking: 'Checking…',
  /** Announced to VoiceOver when Check again answers (iOS has no live regions). */
  checkedNow: 'Checked just now.',
  /** A 429 checked_recently that carries no words of its own (the server's are shown when sent). */
  checkedRecently: 'Checked a moment ago. Try again in a minute.',
});

/** ✓ Ready · ○ Not checked · ◆ Needs setup, in every layout (HUD shows them in capitals). */
export const READINESS_WORDS: Readonly<Record<ReadinessState, string>> = Object.freeze({
  ready: 'Ready',
  not_checked: 'Not checked',
  needs_setup: 'Needs setup',
});

/** The rows this phone adds: their labels, the details the app writes and their fixes. */
export const CLIENT_ROW_COPY = Object.freeze({
  pushLabel: 'Notifications',
  microphoneLabel: 'Microphone',
  speechLabel: 'Speech recognition',
  serverVoiceLabel: 'Server voice',
  /** Not read yet on this phone (the app is still finding out). */
  notReadYet: 'Not checked yet on this phone.',
  microphoneAllowed: 'Allowed for Automatos Go.',
  /** The microphone or speech recognition has not been asked for yet: only a press asks. */
  notAskedYet: 'Not asked yet. Hold to talk asks the first time you use it.',
  speechReady: (language: string) => `Hold to talk understands ${language} on this phone.`,
  serverVoiceOn: "Auto speaks with this server's voice.",
  serverVoicePhoneChosen:
    "This server has a voice. You chose the phone's voice in Settings → Voice.",
  serverVoiceOff: "This server has no voice of its own, so Auto speaks with the phone's voice.",
  serverVoiceUnanswered: "The server's voices didn't answer.",
  /** Fixes: in-app paths only. */
  openNotifications: 'Open Notifications',
  openVoice: 'Open voice',
});
