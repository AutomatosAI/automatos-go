// What a press and a release of HOLD TO TALK come to (KV5, US-019g). Pure: no React, React Native
// or Expo; the engine (quick-ask-engine.ts) runs the plan.
//   onPress: a viewer never talks (D17, the mic never opens; nothing waits on the AI label, D73);
//   then the press's permission verdict (US-019c: a prompt took the hold, or Settings must help);
//   then the recognition policy (US-019b: on the phone or not at all; 'download' is the offer).
//   A press that cannot start leaves a reply under way alone. One that can runs its steps in order:
//   the speech stops first (barge-in), a turn still streaming is cancelled on the server through
//   A2's Stop (D-STOP; only while it streams), an error is cleared, and only then does the mic open.
//   onRelease: a hold under HOLD_MIN_MS is a tap ('Hold the button while you talk'); a stop phrase
//   as the whole utterance is STOP, nothing sent; words with nothing sayable are nothing heard;
//   anything else is sent, as heard.

import { HOLD_MIN_MS } from '../config';
import type { VoiceEvent } from '../machine/voice-reducer';
import type { VoicePhase } from '../machine/voice-state';
import { permissionEvent, type PermissionVerdict } from '../permissions/permission-flow';
import type { RecognitionCopyKey } from '../strings';
import { refusalCopyKey, type RecognitionPolicy } from './recognition-policy';
import { isStopPhrase } from './stop-phrase';

export type ReadyPolicy = Extract<RecognitionPolicy, { kind: 'ready' }>;

export type PressInput = {
  readonly phase: VoicePhase;
  /** Quick-ask's turn still streams (the reducer's replyStreaming). */
  readonly replyStreaming: boolean;
  readonly roleCanChat: boolean;
  readonly policy: RecognitionPolicy;
  readonly permission: PermissionVerdict;
};

/** Why the press cannot open the mic: a viewer, a permission, or the recognition policy's copy. */
export type BlockedKey = 'viewer' | 'permission' | RecognitionCopyKey;

/** One effect of a press that starts, in the order the engine runs them. */
export type PressStep = 'stop-speech' | 'cancel-turn' | 'reset' | 'listen';

export type PressBlocked = {
  readonly blocked: BlockedKey;
  /** What the reducer hears about it; null when nothing on the voice screen changes. */
  readonly event: VoiceEvent | null;
};

export type PressStart = {
  /** Auto is replying: the speech stops at once (barge-in). */
  readonly stopSpeech: boolean;
  /** Quick-ask's turn still streams: A2's Stop cancels it on the server. */
  readonly cancelTurn: boolean;
  /** The voice screen shows an error: cleared before the hold, so hold_start takes. */
  readonly reset: boolean;
  /** The policy the recognizer starts with: on the phone, always. */
  readonly start: ReadyPolicy;
  readonly steps: readonly PressStep[];
};

export type PressPlan = PressBlocked | PressStart;

export type ReleaseInput = { readonly heard: string; readonly heldMs: number };

export type ReleasePlan = 'too-short' | 'nothing' | 'stop' | { readonly send: string };

/** Auto has the turn: a press now interrupts the reply. */
const REPLYING: ReadonlySet<VoicePhase> = new Set<VoicePhase>(['thinking', 'speaking']);

/** Something a voice could have said: a letter or a digit. */
const SAYABLE = /[\p{L}\p{N}]/u;

function blocked(key: BlockedKey, event: VoiceEvent | null): PressBlocked {
  return Object.freeze({ blocked: key, event });
}

function refusal(policy: Exclude<RecognitionPolicy, { kind: 'ready' }>): PressBlocked {
  const event: VoiceEvent | null =
    policy.kind === 'unavailable' ? { type: 'unavailable', reason: policy.reason } : null;
  return blocked(refusalCopyKey(policy), event);
}

export function isStartPlan(plan: PressPlan): plan is PressStart {
  return !('blocked' in plan);
}

export function onPress(input: PressInput): PressPlan {
  if (!input.roleCanChat) return blocked('viewer', null);
  const permission = permissionEvent(input.permission);
  if (permission !== null) return blocked('permission', permission);
  if (input.policy.kind !== 'ready') return refusal(input.policy);
  const stopSpeech = REPLYING.has(input.phase);
  const cancelTurn = input.replyStreaming;
  const reset = input.phase === 'error';
  const steps: PressStep[] = [
    ...(stopSpeech ? (['stop-speech'] as const) : []),
    ...(cancelTurn ? (['cancel-turn'] as const) : []),
    ...(reset ? (['reset'] as const) : []),
    'listen',
  ];
  return Object.freeze({
    stopSpeech,
    cancelTurn,
    reset,
    start: input.policy,
    steps: Object.freeze(steps),
  });
}

/** A hold this short is a tap (NaN too: no hold was measured). */
export function isTap(heldMs: number): boolean {
  return !(heldMs >= HOLD_MIN_MS);
}

export function onRelease(input: ReleaseInput): ReleasePlan {
  if (isTap(input.heldMs)) return 'too-short';
  if (isStopPhrase(input.heard)) return 'stop';
  const text = input.heard.trim();
  if (!SAYABLE.test(text)) return 'nothing';
  return Object.freeze({ send: text });
}
