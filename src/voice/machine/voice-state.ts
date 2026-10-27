// The voice screen's one state (KV8, US-019a): every word and button on the voice screen reads it
// through the view-model, so quick-ask (and, in phase 2, Live) can never show two truths. Pure and
// immutable: voice-reducer.ts returns a NEW state for each event. The phase is what Auto is doing;
// micOpen is separate, the capture truth that MIC LIVE shows (KV5): the recognizer's audiostart opens
// it and its audioend closes it, whatever the button or the phase says.

import type { ThreadFailure } from '../../chat/controller/thread';

export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

/** Quick-ask: hold, hear, send, speak. Phase 2 (US-020c) adds 'live'. */
export type VoiceMode = 'quick';

/**
 * The AI notice shown as its own AUTO line before the first spoken reply of a voice session (KV7).
 * Once per session and never repeated: there is no reminder (D73).
 */
export type VoiceNotice = 'greeting' | null;

/**
 * Why hold to talk cannot work on this phone (KV4): recognition runs on the phone or not at all.
 * 'other-language' (iOS): the chosen language is not the iPhone's own, the one the module checks.
 */
export type UnavailableReason =
  'no-on-device' | 'android-too-old' | 'language-missing' | 'no-recognizer' | 'other-language';

/** Where the microphone (and, on iOS, speech recognition) permission stands at a press (US-019c). */
export type PermissionStep = 'granted' | 'ask' | 'settings' | 'restricted';

/** A recognizer failure that is not an interruption or an unavailable recognizer (US-019b). */
export type RecognizerFailure = 'mic-busy' | 'busy' | 'recognizer';

/** What ended a voice turn from outside (KV10): a call or Siri, a lost headset, the background. */
export type InterruptReason = 'audio-session' | 'route-change' | 'background';

/** A2's failure kind for the turn quick-ask sent: the client's taxonomy kind, or the server's 'turn'. */
export type TurnFailureKind = ThreadFailure['kind'];

/**
 * The error phase's kind. Retryable ones (a busy mic or recognizer, a failed turn) let the next
 * hold start; the others need the phone or the permission to change first (the hook re-checks and
 * dispatches reset).
 */
export type VoiceErrorKind =
  UnavailableReason | 'permission-settings' | 'permission-restricted' | RecognizerFailure | 'turn';

/** A copy key for the line under the core: a hint, a ready, an interruption (src/voice/strings.ts). */
export type VoiceMessage = 'holdHint' | 'nothingHeard' | 'ready' | 'interrupted' | 'micChanged';

export type VoiceState = {
  readonly phase: VoicePhase;
  readonly mode: VoiceMode;
  /** The recognizer is capturing: true only between mic_open and mic_closed (MIC LIVE, KV5). */
  readonly micOpen: boolean;
  /** The YOU words: the partial result while listening, the final one after. */
  readonly heard: string;
  /** Auto's words so far (plain text, as the turn streams). */
  readonly reply: string;
  /** The sent turn is still streaming (STOP cancels it on the server). */
  readonly replyStreaming: boolean;
  /** The sent turn has finished streaming; the speech may still be going. */
  readonly replyFinished: boolean;
  /** The running tool's words ('Searching the web'), else null. */
  readonly toolCaption: string | null;
  readonly notice: VoiceNotice;
  readonly errorKind: VoiceErrorKind | null;
  /** A2's kind for a failed turn (errorKind 'turn'), else null. */
  readonly turnFailure: TurnFailureKind | null;
  readonly message: VoiceMessage | null;
  /** When the current hold began, in ms (the hook's clock); null when not holding. */
  readonly holdStartedAt: number | null;
  /** The hold interrupted Auto thinking or speaking (KV5: the hook stops speech, cancels the turn). */
  readonly bargedIn: boolean;
};

/** Every field a primitive or null, so freezing the object freezes all of it. */
export const INITIAL_VOICE_STATE: VoiceState = Object.freeze({
  phase: 'idle',
  mode: 'quick',
  micOpen: false,
  heard: '',
  reply: '',
  replyStreaming: false,
  replyFinished: false,
  toolCaption: null,
  notice: null,
  errorKind: null,
  turnFailure: null,
  message: null,
  holdStartedAt: null,
  bargedIn: false,
});

const RETRYABLE: ReadonlySet<VoiceErrorKind> = new Set<VoiceErrorKind>([
  'mic-busy',
  'busy',
  'recognizer',
  'turn',
]);

/** The next hold may start from this error; the others wait for the phone or permission to change. */
export function isRetryable(kind: VoiceErrorKind | null): boolean {
  return kind !== null && RETRYABLE.has(kind);
}

/** Words to send or speak: anything but blank. */
export function hasWords(text: string): boolean {
  return text.trim().length > 0;
}
