// The voice wave's copy (one strings module per feature, §4.11). Quick-ask's words may say the
// voice is recognised on this phone (true by KV4: recognition runs on the phone or not at all); they
// never claim more than that (KV18), and say nothing commercial (D8).

import type { RecognizerFailure, VoiceMessage } from './machine/voice-state';

/** Which words say why hold to talk cannot start (recognition-policy.ts refusalCopyKey). */
export type RecognitionCopyKey = 'androidTooOld' | 'notOnPhone' | 'download';

/**
 * Hold to talk cannot start on this phone (KV4), by the policy's copy key. {language} is the
 * phone's language by name (languageName in recognition-policy.ts). Typing always stays.
 */
export const RECOGNITION_COPY: Readonly<Record<RecognitionCopyKey, (language: string) => string>> =
  Object.freeze({
    androidTooOld: () =>
      'Hold to talk needs Android 13 or later, so your voice is recognised on this phone. You can type to Auto instead.',
    notOnPhone: (language: string) =>
      `Hold to talk needs speech recognition that runs on this phone, and it isn't available for ${language}. You can type to Auto instead.`,
    download: (language: string) =>
      `Download the ${language} speech model to talk to Auto. It stays on your phone.`,
  });

/** The button under the download offer: androidTriggerOfflineModelDownload. */
export const DOWNLOAD_ACTION = 'Download';

/**
 * Microphone and speech recognition permissions (US-019c), asked only from a press. micOff and
 * speechOff name the permission that is off (speech recognition: iOS quick-ask only) with
 * openSettings; restricted (Screen Time) has no button. ready follows a first-time grant: the
 * prompt took the hold that raised it (the reducer's 'ready' message).
 */
export const PERMISSION_COPY = Object.freeze({
  micOff: "Automatos Go can't hear you: the microphone is off for it. Turn it on in Settings.",
  speechOff:
    "Automatos Go can't hear you: speech recognition is off for it. Turn it on in Settings.",
  restricted: 'The microphone or speech recognition is restricted on this phone (Screen Time).',
  openSettings: 'Open Settings',
  ready: 'Ready. Hold to talk.',
});

/**
 * Languages by name, keyed by the locale's language subtag ('en' for 'en-GB'), for the copy above.
 * A language not listed is named by its locale tag.
 */
export const LANGUAGE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  ar: 'Arabic',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  fi: 'Finnish',
  fr: 'French',
  ga: 'Irish',
  he: 'Hebrew',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nb: 'Norwegian',
  nl: 'Dutch',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  zh: 'Chinese',
});

/**
 * The AI notice (KV7, PRD-264 EUAI-04): shown as its own AUTO line and spoken once, before the first
 * spoken reply of a voice session, and never repeated (no reminder, D73). The server's own words,
 * copied from automatos-ai orchestrator/modules/policy/ai_disclosure.py VOICE_GREETING @ 7ae677b52
 * (the line as written in 10e594213); notice/ai-notice.ts puts the answering agent's name in place
 * of Auto.
 */
export const AI_VOICE_GREETING = 'Hi, this is Auto, your AI assistant.';

/**
 * What the voice says in place of what speech cannot carry (toSpeakable, US-019d): a code block, a
 * table, a URL. The words are on screen in the chat; the voice only points there.
 */
export const SPOKEN_COPY = Object.freeze({
  code: "There's code in the chat.",
  table: "There's a table in the chat.",
  link: 'a link',
});

/**
 * The line under the core after an interruption (KV10): the reducer's 'interrupted' (a call, Siri or
 * an alarm took the audio, or the app left the screen) and 'micChanged' (the microphone went away
 * mid-hold) messages. Nothing reopens the mic by itself: the words ask for the next hold.
 */
export const INTERRUPTION_COPY = Object.freeze({
  interrupted: "Interrupted. Hold to talk when you're ready.",
  micChanged: 'The microphone changed. Hold to talk again.',
} satisfies Partial<Record<VoiceMessage, string>>);

/**
 * The state chip under the core (US-019i): what the voice screen is doing, in capitals, the text twin
 * of the rings and the waveform; label is what VoiceOver and TalkBack read. A running tool's words
 * replace THINKING ('SEARCHING THE WEB', the vendored caption in capitals).
 */
export const VOICE_CHIP = Object.freeze({
  ready: { words: 'READY', label: 'Ready' },
  listening: { words: 'LISTENING', label: 'Listening' },
  thinking: { words: 'THINKING', label: 'Thinking' },
  speaking: { words: 'SPEAKING', label: 'Speaking' },
  unavailable: { words: 'VOICE UNAVAILABLE', label: 'Voice unavailable' },
  micOff: { words: 'MIC OFF', label: 'Microphone off' },
  error: { words: 'ERROR', label: 'Something went wrong' },
});

/**
 * HOLD TO TALK (KV5): held, it talks while pressed and sends on release; under a screen reader it
 * toggles instead (double-tap to talk, double-tap to send) and its hint says so.
 */
export const VOICE_CENTRE_COPY = Object.freeze({
  hold: {
    talk: {
      label: 'HOLD TO TALK',
      spoken: 'Hold to talk',
      hint: 'Hold while you talk, then let go to send.',
    },
    send: { label: 'RELEASE TO SEND', spoken: 'Release to send', hint: 'Let go to send.' },
  },
  toggle: {
    talk: {
      label: 'TAP TO TALK',
      spoken: 'Tap to talk',
      hint: 'Double-tap to talk, then double-tap again to send.',
    },
    send: { label: 'TAP TO SEND', spoken: 'Tap to send', hint: 'Double-tap to send.' },
  },
});

/**
 * The line under the core for the reducer's messages (US-019i): a tap that was not a hold, a hold
 * that heard nothing, the first-time permission grant, and the interruptions (KV10).
 */
export const VOICE_MESSAGE_COPY = Object.freeze({
  holdHint: 'Hold the button while you talk.',
  nothingHeard: 'Nothing was heard. Hold to talk and try again.',
  ready: PERMISSION_COPY.ready,
  interrupted: INTERRUPTION_COPY.interrupted,
  micChanged: INTERRUPTION_COPY.micChanged,
} satisfies Record<VoiceMessage, string>);

/** The recognizer could not take the hold (US-019b's failures); the next hold may try again. */
export const VOICE_ERROR_COPY = Object.freeze({
  'mic-busy': "The microphone isn't free. Another app may be using it. Hold to talk again.",
  busy: 'Speech recognition is busy. Hold to talk again in a moment.',
  recognizer: 'Speech recognition stopped. Hold to talk again.',
} satisfies Record<RecognizerFailure, string>);

/** The reply came with cards or a list of what Auto did: the chat shows them (KV6, routes.chat). */
export const SEE_IN_CHAT = 'See it in the chat';

/**
 * The voice screen's own words around A5's core (US-019j): the menu square closes the screen, and
 * LOOK opens the style's look page (src/voice/nav.ts voiceLookPath).
 */
export const VOICE_SCREEN_COPY = Object.freeze({
  close: 'Close voice',
  lookHint: 'Opens the look settings for this style',
});
