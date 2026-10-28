// Whether hold to talk may start recognition on this phone (KV4, US-019b), from what recognizer.ts
// probed. Pure: no React, React Native or Expo.
//   iOS, the iPhone's own language: ready only when the recognizer supports on-device recognition
//   (and is available). The module sets requiresOnDeviceRecognition only when supported and
//   otherwise silently uses Apple's servers (ios/ExpoSpeechRecognizer.swift:579-580), so the app
//   checks first and never starts otherwise. Limit: the module's iOS check takes no locale
//   (SFSpeechRecognizer(), the user's default language) while start() listens in the phone's first
//   preferred language; where the two differ the check may vouch for the wrong recognizer. Closing
//   that needs a per-locale native check (a FOUNDATION GAP in the kit's US-019b notes); the
//   airplane-mode device checks prove it.
//   iOS, another language chosen in "I speak" (Gerard, 27 Oct 2026: Portuguese (Brazil) on an
//   English iPhone): ready, listening in the chosen locale with requiresOnDeviceRecognition true.
//   The module's check covers the default language only, so the app cannot ask about this one;
//   start() builds the recognizer for the chosen locale (ExpoSpeechRecognizer.swift:60) and
//   recognises on the iPhone when that language's dictation model is installed, else on Apple's
//   servers (Apple processes the audio; the app receives only the text). Settings says so under
//   I speak (language-rows.ts languageNote). A recognizer the module finds unavailable refuses
//   itself ('service-not-allowed', recognizer-events.ts).
//   Android: ready only on API 33+ (the module's on-device recognizer, ExpoSpeechService.kt:93-109)
//   with on-device recognition supported and the locale (or its language: 'en' for 'en-GB') among
//   the on-device recognizer's installed languages; supported but not installed → 'download'.
//   Anything else is unavailable with its reason: there is no network fallback. The chosen language
//   gets the same check.
// The 'ready' options are frozen and always carry requiresOnDeviceRecognition true; they name no
// service package, no recording and no audio source (audio is never saved).

import { ANDROID_ON_DEVICE_API, VOLUME_INTERVAL_MS } from '../config';
import type { UnavailableReason } from '../machine/voice-state';
import { LANGUAGE_NAMES, type RecognitionCopyKey } from '../strings';

export type RecognitionPlatform = 'ios' | 'android';

/** What recognizer.ts read from the module and the phone. */
export type RecognitionProbe = {
  readonly platform: RecognitionPlatform;
  /** Android's API level (Platform.Version); absent on iOS. */
  readonly androidApiLevel?: number;
  readonly supportsOnDevice: boolean;
  readonly recognitionAvailable: boolean;
  /** The language recognition listens for: "I speak"'s (language/speak-language.ts). */
  readonly locale: string;
  /**
   * The phone's first locale (locale.ts): on iOS the one language the module's check covers; any
   * other is recognised as the module does (above). Absent: the same as `locale`.
   */
  readonly phoneLocale?: string;
  /** Android: getSupportedLocales' locales (supported, installed or not). */
  readonly supportedLocales?: readonly string[];
  /** Android: getSupportedLocales' installedLocales (ready for on-device use). */
  readonly installedLocales?: readonly string[];
};

/**
 * The start options for a 'ready' policy. The literals are expo-speech-recognition's own constant
 * values (build/constants.d.ts AVAudioSessionCategory.playAndRecord,
 * AVAudioSessionCategoryOptions.defaultToSpeaker and .allowBluetooth): recognizer.ts hands these
 * to the module's typed start(), so a wrong name fails the typecheck there.
 */
export type OnDeviceOptions = {
  readonly lang: string;
  readonly interimResults: true;
  readonly continuous: true;
  readonly requiresOnDeviceRecognition: true;
  readonly addsPunctuation: true;
  readonly maxAlternatives: 1;
  readonly volumeChangeEventOptions: { readonly enabled: true; readonly intervalMillis: number };
  readonly iosCategory: {
    readonly category: 'playAndRecord';
    readonly categoryOptions: readonly ('defaultToSpeaker' | 'allowBluetooth')[];
  };
};

export type RecognitionPolicy =
  | { readonly kind: 'ready'; readonly options: OnDeviceOptions }
  | { readonly kind: 'download'; readonly locale: string }
  | { readonly kind: 'unavailable'; readonly reason: UnavailableReason };

const IOS_CATEGORY = Object.freeze({
  category: 'playAndRecord',
  categoryOptions: Object.freeze(['defaultToSpeaker', 'allowBluetooth'] as const),
} as const);

const VOLUME_EVENTS = Object.freeze({ enabled: true, intervalMillis: VOLUME_INTERVAL_MS } as const);

/** The one way to build start options: requiresOnDeviceRecognition true, every time. */
export function onDeviceOptions(locale: string): OnDeviceOptions {
  return Object.freeze({
    lang: locale,
    interimResults: true,
    continuous: true,
    requiresOnDeviceRecognition: true,
    addsPunctuation: true,
    maxAlternatives: 1,
    volumeChangeEventOptions: VOLUME_EVENTS,
    iosCategory: IOS_CATEGORY,
  });
}

function ready(locale: string): RecognitionPolicy {
  return Object.freeze({ kind: 'ready', options: onDeviceOptions(locale) });
}

function unavailable(reason: UnavailableReason): RecognitionPolicy {
  return Object.freeze({ kind: 'unavailable', reason });
}

/** 'en_GB' and 'EN-gb' alike → 'en-gb'. */
function normalise(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

/** The language subtag: 'en' for 'en-GB'. */
export function languageOf(locale: string): string {
  return normalise(locale).split('-')[0] ?? '';
}

/** The entry of the list that is the locale, else the one that is its language; else null. */
export function matchLocale(locale: string, list: readonly string[]): string | null {
  const exact = normalise(locale);
  const language = languageOf(locale);
  return (
    list.find((entry) => normalise(entry) === exact) ??
    list.find((entry) => normalise(entry) === language) ??
    null
  );
}

/** The phone's language by name for the copy ('English' for 'en-GB'), else the locale tag. */
export function languageName(locale: string): string {
  const language = languageOf(locale);
  return Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, language)
    ? (LANGUAGE_NAMES[language] as string)
    : locale.trim();
}

function androidPolicy(probe: RecognitionProbe): RecognitionPolicy {
  if (matchLocale(probe.locale, probe.installedLocales ?? []) !== null) return ready(probe.locale);
  const supported = matchLocale(probe.locale, probe.supportedLocales ?? []);
  if (supported !== null) return Object.freeze({ kind: 'download', locale: supported });
  return unavailable('language-missing');
}

/** iOS: the module's on-device check covers the phone's own locale and no other. */
function isPhoneLocale(probe: RecognitionProbe): boolean {
  return (
    probe.phoneLocale === undefined || normalise(probe.phoneLocale) === normalise(probe.locale)
  );
}

export function recognitionPolicy(probe: RecognitionProbe): RecognitionPolicy {
  if (probe.platform === 'android' && !((probe.androidApiLevel ?? 0) >= ANDROID_ON_DEVICE_API))
    return unavailable('android-too-old');
  // iOS, a chosen language other than the iPhone's: on the iPhone when installed, else Apple's.
  if (probe.platform === 'ios' && !isPhoneLocale(probe)) return ready(probe.locale);
  if (!probe.supportsOnDevice)
    return unavailable(probe.recognitionAvailable ? 'no-on-device' : 'no-recognizer');
  if (probe.platform === 'android') return androidPolicy(probe);
  // iOS: the module itself refuses to start an unavailable recognizer (ExpoSpeechRecognizer.swift:216).
  return probe.recognitionAvailable ? ready(probe.locale) : unavailable('no-recognizer');
}

/** The copy that says why a policy that is not 'ready' refuses a hold (strings.ts). */
export function refusalCopyKey(
  policy: Exclude<RecognitionPolicy, { kind: 'ready' }>,
): RecognitionCopyKey {
  if (policy.kind === 'download') return 'download';
  return policy.reason === 'android-too-old' ? 'androidTooOld' : 'notOnPhone';
}
