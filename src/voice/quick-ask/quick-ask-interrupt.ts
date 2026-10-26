// Quick-ask's interruptions (KV10, US-019h): the interruption policy's actions run on the engine.
// Pure: no React, React Native or Expo (the ports are quick-ask-store.ts's). The policy decides
// (interruptions/interruption-policy.ts); this only does it, in the order given.
//   abort-recognition → the recognizer aborts (its session says no final: nothing is sent) and gives
//   the audio back; stop-speech → the speech stops and the turn it came from is no longer spoken (it
//   runs on to the chat: never cancelled here); end-notice-session → the next spoken reply greets
//   again (KV7); interrupted → the reducer goes idle with the words kept on screen and the reason's
//   message. Nothing here ever starts the recognizer, the speaker or a turn (KV10).

import { release } from '../audio/audio-owner';
import {
  interruptionActions,
  type InterruptionAction,
  type InterruptionEvent,
} from '../interruptions/interruption-policy';
import { newSession } from '../notice/ai-notice';
import { abortListening, dispatch, get, set, silence, type Engine } from './quick-ask-store';

type ActionOf<K extends InterruptionAction['type']> = Extract<InterruptionAction, { type: K }>;
type Runners = {
  readonly [K in InterruptionAction['type']]: (engine: Engine, action: ActionOf<K>) => void;
};

const RUNNERS: Runners = {
  'abort-recognition': (engine) => {
    abortListening(engine);
    set(engine, { owner: release(get(engine).owner, 'recognizer') });
  },
  'stop-speech': (engine) => {
    silence(engine);
    set(engine, { owner: release(get(engine).owner, 'speaker') });
  },
  'end-notice-session': (engine) => set(engine, { session: newSession() }),
  interrupted: (engine, action) => dispatch(engine, { type: 'interrupted', reason: action.reason }),
};

function run(engine: Engine, action: InterruptionAction): void {
  // TypeScript cannot correlate RUNNERS[type] with the narrowed action; the mapped type checks each entry.
  const runner = RUNNERS[action.type] as (engine: Engine, action: InterruptionAction) => void;
  runner(engine, action);
}

/** The policy's actions for this event over the engine's voice state, run in order. */
export function interrupt(engine: Engine, event: InterruptionEvent): void {
  interruptionActions(event, get(engine).snapshot.voice).forEach((action) => run(engine, action));
}
