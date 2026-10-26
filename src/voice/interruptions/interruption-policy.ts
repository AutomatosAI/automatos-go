// Interruptions (KV10, KV11, US-019h): what quick-ask does when the phone takes the voice away. Pure:
// no React, React Native or Expo. use-interruptions.ts feeds it AppState's changes, the engine feeds
// it the recognizer's errors (interruptionOf), and quick-ask-interrupt.ts runs what it returns.
//   'background' (the screen locking too) → abort recognition (nothing sent), stop speech, end the
//   AI-notice session (KV7); when a hold or a reply was under way, the line under the core says
//   'Interrupted. Hold to talk when you're ready.' (phase 2 adds: leave Live). Android reports a
//   runtime permission dialog as 'background' too (AppStateModule.kt onHostPause): that press ends,
//   as the prompt already takes it (US-019c).
//   'covered' (another screen pushed over HUD's home, whose quick-ask listens only while it is the
//   screen on top, US-019k) → as 'background': the screen is left.
//   iOS 'inactive' (Control Centre, an incoming-call banner, a permission prompt) → nothing by itself.
//   Back to 'active' → NOTHING: the mic, speech and Live never resume by themselves.
//   The recognizer's 'interrupted' error (an AVAudioSession interruption while recognising: a call,
//   Siri, an alarm; or a route change while the app is not active: ExpoSpeechRecognizer.swift:720-775)
//   → abort, the words heard kept on screen un-sent, 'Interrupted. Hold to talk when you're ready.'
//   An 'audio-capture' error while the mic is open is the capture losing its input mid-hold (iOS: a
//   route change the module could not restart the engine for, audioRouteChanged → 'audio-capture',
//   ExpoSpeechRecognitionModule.swift:543-544; Android: SpeechRecognizer.ERROR_AUDIO) → abort, 'The
//   microphone changed. Hold to talk again.' Both platforms send the error before audioend, so micOpen
//   still says whether the capture had started; before it did, 'audio-capture' is the input being busy
//   (another app holds it) and takes its usual way, the reducer's 'mic-busy' error.

import type { InterruptReason, VoicePhase, VoiceState } from '../machine/voice-state';
import type { RecognizerVoiceEvent } from '../quick-ask/recognizer-events';

/** How the recognizer lost the audio: a call, Siri or an alarm, or the microphone going away. */
export type RecognizerInterruption = Exclude<InterruptReason, 'background'>;

export type InterruptionEvent =
  /** AppState's status: 'active', 'background', 'inactive' (iOS), 'unknown' or 'extension'. */
  | { readonly type: 'app'; readonly status: string }
  /** Another screen came over this one (HUD's home under a pushed route): it is left. */
  | { readonly type: 'covered' }
  | { readonly type: 'recognizer'; readonly reason: RecognizerInterruption };

export type InterruptionAction =
  | { readonly type: 'abort-recognition' }
  | { readonly type: 'stop-speech' }
  | { readonly type: 'end-notice-session' }
  /** The reducer's 'interrupted': idle, the words kept on screen, the reason's message. */
  | { readonly type: 'interrupted'; readonly reason: InterruptReason };

/** What the policy reads: the one reducer's phase and the capture truth. */
export type InterruptionState = Pick<VoiceState, 'phase' | 'micOpen'>;

/**
 * AppState's statuses that mean the app is off the screen (the same rule as isForeground in
 * src/api/live-connection.ts; 'extension' is an iOS app extension's).
 */
const AWAY: ReadonlySet<string> = new Set(['background', 'extension']);

/** A hold or a reply is under way: leaving the screen interrupts it. */
const BUSY: ReadonlySet<VoicePhase> = new Set<VoicePhase>(['listening', 'thinking', 'speaking']);

const NONE: readonly InterruptionAction[] = Object.freeze([]);

const frozen = <T extends InterruptionAction | InterruptionEvent>(value: T): T =>
  Object.freeze(value);
const action = (value: InterruptionAction): InterruptionAction => frozen(value);

const ABORT = action({ type: 'abort-recognition' });
const STOP_SPEECH = action({ type: 'stop-speech' });
const END_SESSION = action({ type: 'end-notice-session' });

const LEFT_THE_SCREEN: readonly InterruptionAction[] = Object.freeze([
  ABORT,
  STOP_SPEECH,
  END_SESSION,
]);
const LEFT_MID_TURN: readonly InterruptionAction[] = Object.freeze([
  ...LEFT_THE_SCREEN,
  action({ type: 'interrupted', reason: 'background' }),
]);
const RECOGNIZER_LOST: Readonly<Record<RecognizerInterruption, readonly InterruptionAction[]>> =
  Object.freeze({
    'audio-session': Object.freeze([
      ABORT,
      action({ type: 'interrupted', reason: 'audio-session' }),
    ]),
    'route-change': Object.freeze([ABORT, action({ type: 'interrupted', reason: 'route-change' })]),
  });

const AUDIO_SESSION: InterruptionEvent = frozen({ type: 'recognizer', reason: 'audio-session' });
const ROUTE_CHANGE: InterruptionEvent = frozen({ type: 'recognizer', reason: 'route-change' });

/** The mic is capturing, or a hold is under way. */
function holding(state: InterruptionState): boolean {
  return state.micOpen || state.phase === 'listening';
}

function busy(state: InterruptionState): boolean {
  return state.micOpen || BUSY.has(state.phase);
}

/**
 * The recognizer's event as an interruption, or null when it is not one (it takes its usual way):
 * 'interrupted' always; 'audio-capture' (recognizer-events.ts maps it to the 'mic-busy' error) only
 * while the mic is open.
 */
export function interruptionOf(
  event: RecognizerVoiceEvent,
  state: InterruptionState,
): InterruptionEvent | null {
  if (event.type === 'interrupted') return AUDIO_SESSION;
  if (event.type === 'error' && event.kind === 'mic-busy' && state.micOpen) return ROUTE_CHANGE;
  return null;
}

/**
 * What to do, in order. An app status that is not away does nothing (iOS 'inactive', and 'active':
 * nothing resumes by itself); being covered is leaving. A recognizer interruption after the hold is
 * over (STOP or the release already ended it) does nothing either.
 */
export function interruptionActions(
  event: InterruptionEvent,
  state: InterruptionState,
): readonly InterruptionAction[] {
  if (event.type === 'recognizer') return holding(state) ? RECOGNIZER_LOST[event.reason] : NONE;
  if (event.type === 'app' && !AWAY.has(event.status)) return NONE;
  return busy(state) ? LEFT_MID_TURN : LEFT_THE_SCREEN;
}
