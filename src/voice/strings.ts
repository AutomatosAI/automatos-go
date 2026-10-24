// The voice wave's copy (one strings module per feature, §4.11). Quick-ask's words may say the
// voice is recognised on this phone (true by KV4: recognition runs on the phone or not at all); they
// never claim more than that (KV18), and say nothing commercial (D8).

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
 * What the voice says in place of what speech cannot carry (toSpeakable, US-019d): a code block, a
 * table, a URL. The words are on screen in the chat; the voice only points there.
 */
export const SPOKEN_COPY = Object.freeze({
  code: "There's code in the chat.",
  table: "There's a table in the chat.",
  link: 'a link',
});
