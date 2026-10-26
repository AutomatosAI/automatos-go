// expo-speech-recognition's events, one at a time, in the voice machine's words (US-019b). Pure: no
// React, React Native or Expo. Every payload is parsed (zod, unknown fields ignored); one that does
// not parse is dropped. recognizer-core.ts joins the results of one hold into one utterance.
//   result → partial (isFinal false) or final (isFinal true), the first alternative's transcript;
//   audiostart → mic_open and audioend → mic_closed (the real capture: MIC LIVE, KV5);
//   nomatch → nothing_heard; start and end → the session's own start and end;
//   error → by its code (ERROR_EVENTS); volumechange → the input level, 0..1 (below 0 is silence).

import { z } from 'zod';

import { VOLUME_MAX } from '../config';
import type { VoiceEvent } from '../machine/voice-reducer';

/** The module events quick-ask listens to (recognizer.ts subscribes each one). */
export const RECOGNIZER_EVENTS = Object.freeze([
  'start',
  'audiostart',
  'audioend',
  'result',
  'nomatch',
  'error',
  'end',
  'volumechange',
] as const);

export type NativeEventName = (typeof RECOGNIZER_EVENTS)[number];

/** The reducer events the recognizer can raise. */
export type RecognizerVoiceEvent = Extract<
  VoiceEvent,
  {
    type:
      | 'partial'
      | 'final'
      | 'mic_open'
      | 'mic_closed'
      | 'nothing_heard'
      | 'permission'
      | 'interrupted'
      | 'error'
      | 'unavailable';
  }
>;

/** What the recognizer tells quick-ask: a reducer event, the input level, or its session's edges. */
export type RecognizerEvent =
  | { readonly kind: 'voice'; readonly event: RecognizerVoiceEvent }
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'started' }
  | { readonly kind: 'ended' };

const resultSchema = z.object({
  isFinal: z.boolean(),
  results: z.array(z.object({ transcript: z.string() })),
});
const errorSchema = z.object({ error: z.string() });
const volumeSchema = z.object({ value: z.number() });

const voice = (event: RecognizerVoiceEvent): RecognizerEvent =>
  Object.freeze({ kind: 'voice', event });
const STARTED: RecognizerEvent = Object.freeze({ kind: 'started' });
const ENDED: RecognizerEvent = Object.freeze({ kind: 'ended' });

const NOTHING_HEARD = voice({ type: 'nothing_heard' });
const NOT_ON_PHONE = voice({ type: 'unavailable', reason: 'no-on-device' });
const RECOGNIZER_FAILED = voice({ type: 'error', kind: 'recognizer' });

/**
 * The module's error codes (ExpoSpeechRecognitionErrorCode; Android's 'too-many-requests' too).
 * aborted is ours (STOP, the background): nothing to say. network means the recognizer wanted a
 * server, and on-device recognition never needs one, so it is 'not on this phone'. A code not
 * listed ('bad-grammar', a future one) is a recognizer failure.
 */
const ERROR_EVENTS: ReadonlyMap<string, RecognizerEvent | null> = new Map([
  ['aborted', null],
  ['no-speech', NOTHING_HEARD],
  ['speech-timeout', NOTHING_HEARD],
  ['not-allowed', voice({ type: 'permission', step: 'settings' })],
  ['interrupted', voice({ type: 'interrupted', reason: 'audio-session' })],
  ['audio-capture', voice({ type: 'error', kind: 'mic-busy' })],
  ['language-not-supported', NOT_ON_PHONE],
  ['service-not-allowed', NOT_ON_PHONE],
  ['network', NOT_ON_PHONE],
  ['busy', voice({ type: 'error', kind: 'busy' })],
  ['too-many-requests', voice({ type: 'error', kind: 'busy' })],
  ['client', RECOGNIZER_FAILED],
  ['unknown', RECOGNIZER_FAILED],
]);

/** volumechange's value (-2..10; below 0 is inaudible) as a level from 0 to 1. */
export function volumeLevel(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value / VOLUME_MAX, 1);
}

function fromResult(payload: unknown): RecognizerEvent | null {
  const parsed = resultSchema.safeParse(payload);
  if (!parsed.success) return null;
  const text = parsed.data.results[0]?.transcript ?? '';
  return voice(parsed.data.isFinal ? { type: 'final', text } : { type: 'partial', text });
}

function fromError(payload: unknown): RecognizerEvent | null {
  const parsed = errorSchema.safeParse(payload);
  if (!parsed.success) return RECOGNIZER_FAILED;
  const mapped = ERROR_EVENTS.get(parsed.data.error);
  return mapped === undefined ? RECOGNIZER_FAILED : mapped;
}

function fromVolume(payload: unknown): RecognizerEvent | null {
  const parsed = volumeSchema.safeParse(payload);
  return parsed.success
    ? Object.freeze({ kind: 'level', level: volumeLevel(parsed.data.value) })
    : null;
}

const MAPPERS: Readonly<Record<NativeEventName, (payload: unknown) => RecognizerEvent | null>> =
  Object.freeze({
    start: () => STARTED,
    audiostart: () => voice({ type: 'mic_open' }),
    audioend: () => voice({ type: 'mic_closed' }),
    result: fromResult,
    nomatch: () => NOTHING_HEARD,
    error: fromError,
    end: () => ENDED,
    volumechange: fromVolume,
  });

/** One module event in the voice machine's words; null when there is nothing to say. */
export function toRecognizerEvent(name: NativeEventName, payload: unknown): RecognizerEvent | null {
  return Object.prototype.hasOwnProperty.call(MAPPERS, name) ? MAPPERS[name](payload) : null;
}
