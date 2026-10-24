// The voice machine's test states (US-019a): each phase reached through the reducer itself from the
// initial state, deep-frozen, so every test reads states the table really produces.

import { voiceReducer, type VoiceEvent } from '../machine/voice-reducer';
import { INITIAL_VOICE_STATE, type VoicePhase, type VoiceState } from '../machine/voice-state';

export const NOW = 1_700_000_000_000;

export function run(
  events: readonly VoiceEvent[],
  from: VoiceState = INITIAL_VOICE_STATE,
): VoiceState {
  return events.reduce(voiceReducer, from);
}

/** Freezes the state and everything it holds, so any mutation throws (ES modules are strict). */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((nested) => deepFreeze(nested));
  }
  return value;
}

export const LISTENING: readonly VoiceEvent[] = [
  { type: 'hold_start', now: NOW },
  { type: 'mic_open' },
  { type: 'partial', text: 'what is' },
];
export const THINKING: readonly VoiceEvent[] = [
  ...LISTENING,
  { type: 'mic_closed' },
  { type: 'final', text: '  what is on today?  ' },
  { type: 'sent', notice: 'greeting' },
  { type: 'turn_text', text: 'You have two meetings.' },
];
export const SPEAKING: readonly VoiceEvent[] = [...THINKING, { type: 'speak_start' }];

export const AT: Readonly<Record<VoicePhase, VoiceState>> = deepFreeze({
  idle: INITIAL_VOICE_STATE,
  listening: run(LISTENING),
  thinking: run(THINKING),
  speaking: run(SPEAKING),
  error: run([...LISTENING, { type: 'error', kind: 'busy' }]),
});
export const PHASES = Object.keys(AT) as VoicePhase[];
