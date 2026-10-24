// Quick-ask's engine (US-019g): hold, hear, send through A2's chat controller, speak the reply; STOP
// and 'Auto, stop'. Pure TypeScript over ports: use-quick-ask.ts binds them to the recognizer, the
// speaker, the permission gate and A2's useThread, the tests to spies. No React, React Native or
// Expo. The voice state is the one reducer's (KV8, quick-ask-store.ts); the hold is
// quick-ask-hold.ts's, the turn and its speech quick-ask-reply.ts's, the rules quick-ask-plan.ts's,
// audio-owner.ts's, reply-text.ts's and reply-feed.ts's.
//   STOP → the recognizer aborts (nothing sent), the speech stops and A2's Stop cancels quick-ask's
//   turn while it streams (D-STOP); a typed turn is left alone.
//   The screen: mount starts an AI-notice session (KV7); unmount stops the mic and the speech and
//   ends the session, and the turn runs on with nothing more spoken (KV6).

import type { ThreadState } from '../../chat/controller/thread';
import { claim } from '../audio/audio-owner';
import { newSession } from '../notice/ai-notice';
import type { SpeakerEvent } from '../speech/speaker-core';
import { onRecognizer, press, releaseHold } from './quick-ask-hold';
import { onSpeaker, onThread } from './quick-ask-reply';
import {
  cancelTurn,
  createEngine,
  dispatch,
  endHold,
  get,
  set,
  show,
  silence,
  type Engine,
  type QuickAskDeps,
  type QuickAskSnapshot,
} from './quick-ask-store';
import type { RecognizerEvent } from './recognizer-events';

export type {
  QuickAskContext,
  QuickAskDeps,
  QuickAskSnapshot,
  RecognizerPort,
  ThreadPort,
} from './quick-ask-store';

export type QuickAsk = {
  readonly snapshot: () => QuickAskSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly press: () => Promise<void>;
  readonly release: () => void;
  readonly stop: () => void;
  /** The 'download' offer's button: the on-device speech model for the phone's language. */
  readonly download: () => Promise<void>;
  readonly onRecognizer: (event: RecognizerEvent) => void;
  readonly onSpeaker: (event: SpeakerEvent) => void;
  readonly onThread: (state: ThreadState) => void;
  /** A new AI-notice session (the app went to the background, US-019h). */
  readonly newSession: () => void;
  /** The voice screen mounted: a new AI-notice session (KV7). */
  readonly mount: () => void;
  /** The voice screen unmounted: the mic and the speech stop, and nothing more is spoken (KV6). */
  readonly unmount: () => void;
};

/** The recognizer stops if it may be running: a hold under way, or its audio not yet given back. */
function abortListening(engine: Engine): void {
  const { hold, owner } = get(engine);
  if (hold !== null || owner === 'recognizer') engine.deps.recognizer.abort();
  endHold(engine);
}

/** STOP: listening aborted (nothing sent), the speech stopped, a streaming turn cancelled. */
function stop(engine: Engine): void {
  const { owner, snapshot } = get(engine);
  abortListening(engine);
  silence(engine);
  if (snapshot.voice.replyStreaming) cancelTurn(engine);
  set(engine, { owner: claim(owner, 'none').owner });
  dispatch(engine, { type: 'stop' });
}

function unmount(engine: Engine): void {
  abortListening(engine);
  silence(engine);
  set(engine, { owner: 'none', session: newSession(), mounted: false });
}

async function download(engine: Engine): Promise<void> {
  const { policy } = get(engine).snapshot;
  if (policy?.kind !== 'download') return;
  const outcome = await engine.deps.recognizer.downloadModel(policy.locale);
  if (outcome === 'downloaded') show(engine, { policy: await engine.deps.recognizer.policy() });
}

function subscribe(engine: Engine, listener: () => void): () => void {
  engine.listeners.add(listener);
  return () => engine.listeners.delete(listener);
}

export function createQuickAsk(deps: QuickAskDeps): QuickAsk {
  const engine = createEngine(deps);
  return Object.freeze({
    snapshot: () => get(engine).snapshot,
    subscribe: (listener: () => void) => subscribe(engine, listener),
    press: () => press(engine),
    release: () => releaseHold(engine),
    stop: () => stop(engine),
    download: () => download(engine),
    onRecognizer: (event: RecognizerEvent) => onRecognizer(engine, event),
    onSpeaker: (event: SpeakerEvent) => onSpeaker(engine, event),
    onThread: (state: ThreadState) => onThread(engine, state),
    newSession: () => set(engine, { session: newSession() }),
    mount: () => set(engine, { session: newSession(), mounted: true }),
    unmount: () => unmount(engine),
  });
}
