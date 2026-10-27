// Quick-ask's state and ports (US-019g): what quick-ask-engine.ts, quick-ask-hold.ts and
// quick-ask-reply.ts share. Pure: no React, React Native or Expo. One cell holds the engine's
// state, replaced whole on every change (never mutated in place); the voice state in it is the one
// reducer's (KV8): every event goes through voiceReducer, and the snapshot use-quick-ask.ts reads is
// published only when something in it changed.

import type { GateInput } from '../../api/capabilities';
import type { ThreadState } from '../../chat/controller/thread';
import type { AudioOwner } from '../audio/audio-owner';
import { voiceReducer, type VoiceEvent } from '../machine/voice-reducer';
import { INITIAL_VOICE_STATE, type VoiceState } from '../machine/voice-state';
import { newSession, type NoticeSession } from '../notice/ai-notice';
import type { PermissionGate, PermissionVerdict } from '../permissions/permission-flow';
import type { ReplyVoice } from '../speech/reply-voice';
import type { SpeakOptions } from '../speech/speaker-core';
import type { RecognitionPolicy } from './recognition-policy';
import type { Recognizer } from './recognizer-core';
import type { ReplyFeed } from './reply-feed';
import type { QuickAskReply, TurnTracking } from './reply-text';
import type { QuickAskMessage } from './spoken-mode';

export type RecognizerPort = Pick<Recognizer, 'start' | 'stop' | 'abort' | 'downloadModel'> & {
  /** The recognition policy for the language quick-ask listens in (the speech's language). */
  readonly policy: (locale: string) => Promise<RecognitionPolicy>;
};

/** The voice screen's conversation: A2's useThread (one request, one stream). */
export type ThreadPort = {
  readonly state: ThreadState;
  readonly send: (message: QuickAskMessage) => void;
  readonly stop: () => void;
};

/** What the engine reads at each event: the latest render's values. */
export type QuickAskContext = {
  readonly thread: ThreadPort;
  readonly roleCanChat: boolean;
  readonly discovery: GateInput;
  /**
   * The language quick-ask listens and speaks in ("I speak"; the phone's when Automatic), the voice
   * picked for it (US-019d), and Auto's server voice when chosen.
   */
  readonly speech: SpeakOptions;
};

export type QuickAskDeps = {
  readonly recognizer: RecognizerPort;
  /** The one voice out (reply-voice.ts): newTurn() at each send lets a turn try the server again. */
  readonly speaker: Pick<ReplyVoice, 'speak' | 'stop' | 'newTurn' | 'handOver'>;
  readonly permissions: Pick<PermissionGate, 'press'>;
  readonly context: () => QuickAskContext;
  readonly now: () => number;
  /** Runs `run` after `ms`; returns the cancel. */
  readonly later: (run: () => void, ms: number) => () => void;
};

export type QuickAskSnapshot = {
  readonly voice: VoiceState;
  /** The last press's permission verdict (PermissionNotice); null before any press. */
  readonly permission: PermissionVerdict | null;
  /** The last press's recognition policy ('download' is the offer); null before any press. */
  readonly policy: RecognitionPolicy | null;
  /** The reply to quick-ask's last turn ('See it in the chat' when it has cards or receipts). */
  readonly reply: QuickAskReply | null;
  /** The input level, 0 to 1, while the mic is open; null otherwise. */
  readonly level: number | null;
};

/** One press of HOLD TO TALK, from the press to the recognizer's final. */
export type Hold = {
  readonly id: number;
  readonly pressedAt: number;
  /** The recognizer was started: a release before that never opened the mic. */
  readonly listening: boolean;
  readonly releasedAt: number | null;
  readonly cancelTimer: (() => void) | null;
};

export type Inner = {
  readonly snapshot: QuickAskSnapshot;
  readonly owner: AudioOwner;
  readonly hold: Hold | null;
  /** How many holds this engine has begun: the next hold's id. */
  readonly holds: number;
  readonly tracking: TurnTracking | null;
  readonly feed: ReplyFeed | null;
  /** Words heard and not yet sent: the thread may not send yet (a cancelled turn settles). */
  readonly pending: string | null;
  readonly session: NoticeSession;
  readonly mounted: boolean;
};

export type Engine = {
  readonly deps: QuickAskDeps;
  readonly cell: { current: Inner };
  readonly listeners: Set<() => void>;
};

const SNAPSHOT: QuickAskSnapshot = Object.freeze({
  voice: INITIAL_VOICE_STATE,
  permission: null,
  policy: null,
  reply: null,
  level: null,
});

export function createEngine(deps: QuickAskDeps): Engine {
  const current: Inner = {
    snapshot: SNAPSHOT,
    owner: 'none',
    hold: null,
    holds: 0,
    tracking: null,
    feed: null,
    pending: null,
    session: newSession(),
    mounted: false,
  };
  return { deps, cell: { current }, listeners: new Set() };
}

export const get = (engine: Engine): Inner => engine.cell.current;

export function set(engine: Engine, changes: Partial<Inner>): void {
  engine.cell.current = { ...get(engine), ...changes };
}

/** A new snapshot when anything in it changes; every listener hears of it. */
export function show(engine: Engine, changes: Partial<QuickAskSnapshot>): void {
  const current = get(engine).snapshot;
  const keys = Object.keys(changes) as (keyof QuickAskSnapshot)[];
  if (!keys.some((key) => current[key] !== changes[key])) return;
  set(engine, { snapshot: Object.freeze({ ...current, ...changes }) });
  engine.listeners.forEach((listener) => listener());
}

/** The event through the one reducer; the input level only while the mic is open. */
export function dispatch(engine: Engine, event: VoiceEvent): void {
  const voice = voiceReducer(get(engine).snapshot.voice, event);
  const level = voice.micOpen ? (get(engine).snapshot.level ?? 0) : null;
  show(engine, { voice, level });
}

/** The hold is over: its HOLD_MAX_MS or RELEASE_SETTLE_MS timer cancelled. */
export function endHold(engine: Engine): void {
  get(engine).hold?.cancelTimer?.();
  set(engine, { hold: null });
}

/**
 * The recognizer stops if it may be running: a hold under way, its audio not yet given back, or a
 * capture the reducer saw open (micOpen, the capture truth: KV5), with or without a hold. Callers
 * run this before their reducer event closes micOpen.
 */
export function abortListening(engine: Engine): void {
  const { hold, owner, snapshot } = get(engine);
  const capturing = hold !== null || owner === 'recognizer' || snapshot.voice.micOpen;
  if (capturing) engine.deps.recognizer.abort();
  endHold(engine);
}

/** Quick-ask's turn is no longer followed: nothing more of it is spoken, nothing waits to send. */
export function letGo(engine: Engine): void {
  set(engine, { tracking: null, feed: null, pending: null });
}

/** Auto's speech stops, and the turn it came from is no longer spoken. */
export function silence(engine: Engine): void {
  engine.deps.speaker.stop();
  letGo(engine);
}

/**
 * Barge-in: as silence(), but the recognizer takes the audio session next, so the voice out leaves
 * it as it is (reply-voice.ts handOver).
 */
export function handOverSpeech(engine: Engine): void {
  engine.deps.speaker.handOver();
  letGo(engine);
}

/** A2's Stop: the read ends and the server cancels the turn (D-STOP). */
export function cancelTurn(engine: Engine): void {
  letGo(engine);
  engine.deps.context().thread.stop();
}
