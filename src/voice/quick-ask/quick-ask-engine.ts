// Quick-ask's engine (US-019g): hold, hear, send through A2's chat controller, speak the reply; STOP
// and 'Auto, stop'. Pure TypeScript over ports: use-quick-ask.ts binds them to the recognizer, the
// speaker, the permission gate and A2's useThread, the tests to spies. No React, React Native or
// Expo. The voice state is the one reducer's (KV8, quick-ask-store.ts); the hold is
// quick-ask-hold.ts's, the turn and its speech quick-ask-reply.ts's, the rules quick-ask-plan.ts's,
// audio-owner.ts's, reply-text.ts's and reply-feed.ts's.
//   STOP → the recognizer aborts (nothing sent), the speech stops and A2's Stop cancels quick-ask's
//   turn while it streams (D-STOP); a typed turn is left alone.
//   The screen: mount starts an AI-notice session (KV7); unmount stops the mic and the speech and
//   ends the session, and the turn runs on with nothing more spoken (KV6). interrupt() takes what
//   use-interruptions.ts hears (AppState) through the interruption policy (US-019h).
//   attach() is the screen taking the recognizer's and the speaker's one listener, and mounting.
//   Another screen's engine that takes either one covers this one (the policy's 'covered': the hold
//   aborted with nothing sent, the speech silenced, the AI-notice session ended); when it lets go,
//   this one hears again, with no new attach (P001V-RVW-2: the voice screen under a conversation's
//   HUD home that was pushed over it and popped).
//   languageChanged() ("I speak" or the EN/PT switch): a refusal or download offer that was about
//   the old language no longer stands; the next press checks the new one. A hold under way is left
//   alone, and so is a phone too old for any language.

import type { ThreadState } from '../../chat/controller/thread';
import { claim } from '../audio/audio-owner';
import { COVERED, type InterruptionEvent } from '../interruptions/interruption-policy';
import type { VoiceErrorKind } from '../machine/voice-state';
import { newSession } from '../notice/ai-notice';
import type { Speaker, SpeakerEvent } from '../speech/speaker-core';
import { onRecognizer, press, releaseHold } from './quick-ask-hold';
import { interrupt } from './quick-ask-interrupt';
import { onSpeaker, onThread } from './quick-ask-reply';
import {
  abortListening,
  cancelTurn,
  createEngine,
  dispatch,
  get,
  set,
  show,
  silence,
  type Engine,
  type QuickAskDeps,
  type QuickAskSnapshot,
} from './quick-ask-store';
import type { Recognizer } from './recognizer-core';
import type { RecognizerEvent } from './recognizer-events';

export type {
  QuickAskContext,
  QuickAskDeps,
  QuickAskSnapshot,
  RecognizerPort,
  ThreadPort,
} from './quick-ask-store';

/** What a screen's engine listens to: the recognizer and the speaker, one listener each. */
export type QuickAskSources = {
  readonly recognizer: Pick<Recognizer, 'listen'>;
  readonly speaker: Pick<Speaker, 'listen'>;
};

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
  /** A new AI-notice session (the next spoken reply greets again). */
  readonly newSession: () => void;
  /** The language it listens in changed: a refusal about the old one is cleared. */
  readonly languageChanged: () => void;
  /** The app's state changed (use-interruptions.ts): the interruption policy decides (US-019h). */
  readonly interrupt: (event: InterruptionEvent) => void;
  /** The voice screen mounted: a new AI-notice session (KV7). */
  readonly mount: () => void;
  /** The voice screen unmounted: the mic and the speech stop, and nothing more is spoken (KV6). */
  readonly unmount: () => void;
  /** The screen takes the recognizer's and the speaker's listener and mounts; returns the detach. */
  readonly attach: (sources: QuickAskSources) => () => void;
};

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

/** Listening and mounted until the detach; covered whenever another engine takes a listener. */
function attach(engine: Engine, sources: QuickAskSources): () => void {
  const covered = (): void => interrupt(engine, COVERED);
  const unlistenRecognizer = sources.recognizer.listen(
    (event) => onRecognizer(engine, event),
    covered,
  );
  const unlistenSpeaker = sources.speaker.listen((event) => onSpeaker(engine, event), covered);
  set(engine, { session: newSession(), mounted: true });
  return () => {
    unlistenRecognizer();
    unlistenSpeaker();
    unmount(engine);
  };
}

/** The language the engine listens in: the speech's (the hook's "I speak"). */
function listening(engine: Engine): string {
  return engine.deps.context().speech.language;
}

async function download(engine: Engine): Promise<void> {
  const { policy } = get(engine).snapshot;
  if (policy?.kind !== 'download') return;
  const outcome = await engine.deps.recognizer.downloadModel(policy.locale);
  if (outcome === 'downloaded')
    show(engine, { policy: await engine.deps.recognizer.policy(listening(engine)) });
}

/** Refusals that are about the language: another may start (not a phone too old for any). */
const LANGUAGE_REFUSALS: ReadonlySet<VoiceErrorKind> = new Set<VoiceErrorKind>([
  'no-on-device',
  'language-missing',
  'no-recognizer',
  'other-language',
]);

function languageChanged(engine: Engine): void {
  const { hold, snapshot } = get(engine);
  if (hold !== null) return;
  const { policy, voice } = snapshot;
  const tooOld = policy?.kind === 'unavailable' && policy.reason === 'android-too-old';
  if (policy !== null && policy.kind !== 'ready' && !tooOld) show(engine, { policy: null });
  if (voice.errorKind !== null && LANGUAGE_REFUSALS.has(voice.errorKind))
    dispatch(engine, { type: 'reset' });
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
    languageChanged: () => languageChanged(engine),
    interrupt: (event: InterruptionEvent) => interrupt(engine, event),
    mount: () => set(engine, { session: newSession(), mounted: true }),
    unmount: () => unmount(engine),
    attach: (sources: QuickAskSources) => attach(engine, sources),
  });
}
