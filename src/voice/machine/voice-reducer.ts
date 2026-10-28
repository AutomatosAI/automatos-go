// The voice machine (KV8, US-019a): one pure reducer for idle, listening, thinking, speaking and
// error. The hooks feed it the recognizer's, the chat controller's and the speaker's events and run
// its effects; nothing else holds voice state. The table:
//   idle → listening on hold_start; error → listening on hold_start only for a retryable kind;
//   thinking or speaking → listening on hold_start with bargedIn (KV5: the hook stops the speech and
//   cancels a streaming turn through A2's Stop);
//   listening → thinking on a final with words; → idle on hold_too_short and nothing_heard (each with
//   its hint) and on stop_phrase ('Auto, stop': nothing sent);
//   thinking: sent marks the turn streaming (with the AI notice when it is the session's first);
//   turn_text and turn_tool update the reply and the tool caption in thinking or speaking;
//   thinking → speaking on speak_start; speaking → idle on speak_done once the turn finished (back
//   to thinking while it still streams: Auto is working, not speaking); thinking → idle when the turn
//   finished with no words to speak; a failed turn → error 'turn'; error 'turn' → thinking on
//   turn_resumed (the read broke but the turn ran on: A2's detached check, its saved reply);
//   stop and interrupted from any phase → idle with the words kept on screen (interrupted with its
//   message); unavailable, a denied permission and a recognizer failure → error with its kind.
// micOpen opens only on mic_open (the recognizer's audiostart) and closes on mic_closed, or when STOP
// or an interruption ends the capture: never from the phase or the button (MIC LIVE, KV5). A press
// that cannot start (unavailable, a permission) never cuts short a reply under way. Time comes in
// the events (hold_start's now): no clock in here. An event that changes nothing, or one this
// version does not know, returns the same state object.

import {
  INITIAL_VOICE_STATE,
  hasWords,
  isRetryable,
  type InterruptReason,
  type PermissionStep,
  type RecognizerFailure,
  type TurnFailureKind,
  type UnavailableReason,
  type VoiceMessage,
  type VoiceNotice,
  type VoicePhase,
  type VoiceState,
} from './voice-state';

export type VoiceEvent =
  | { readonly type: 'hold_start'; readonly now: number }
  | { readonly type: 'mic_open' }
  | { readonly type: 'partial'; readonly text: string }
  | { readonly type: 'mic_closed' }
  | { readonly type: 'final'; readonly text: string }
  | { readonly type: 'hold_too_short' }
  | { readonly type: 'nothing_heard' }
  | { readonly type: 'stop_phrase' }
  /** The turn went through A2's controller; notice: the AI notice precedes its reply (KV7). */
  | { readonly type: 'sent'; readonly notice?: VoiceNotice }
  /** Auto's words so far for the sent turn (the whole text, not a delta). */
  | { readonly type: 'turn_text'; readonly text: string }
  /** The running tool's words, or null when none runs. */
  | { readonly type: 'turn_tool'; readonly caption: string | null }
  | { readonly type: 'turn_finished' }
  | { readonly type: 'turn_failed'; readonly kind: TurnFailureKind }
  /** The turn whose read broke runs on (A2's detached check), or its saved reply came: Auto has it. */
  | { readonly type: 'turn_resumed' }
  | { readonly type: 'speak_start' }
  | { readonly type: 'speak_done' }
  | { readonly type: 'stop' }
  | { readonly type: 'error'; readonly kind: RecognizerFailure }
  | { readonly type: 'unavailable'; readonly reason: UnavailableReason }
  | { readonly type: 'permission'; readonly step: PermissionStep }
  | { readonly type: 'interrupted'; readonly reason: InterruptReason }
  | { readonly type: 'reset' };

type EventOf<K extends VoiceEvent['type']> = Extract<VoiceEvent, { type: K }>;
type Handler<K extends VoiceEvent['type']> = (state: VoiceState, event: EventOf<K>) => VoiceState;
type Handlers = { readonly [K in VoiceEvent['type']]: Handler<K> };

/** Auto has the turn: the reply is coming or being spoken. */
const REPLYING: ReadonlySet<VoicePhase> = new Set<VoicePhase>(['thinking', 'speaking']);

const INTERRUPT_MESSAGES: Readonly<Record<InterruptReason, VoiceMessage>> = Object.freeze({
  'audio-session': 'interrupted',
  'route-change': 'micChanged',
  background: 'interrupted',
});

/** What a new hold clears: the last turn's words, its notice and any error or hint. */
const NEW_TURN = Object.freeze({
  heard: '',
  reply: '',
  replyStreaming: false,
  replyFinished: false,
  toolCaption: null,
  notice: null,
  errorKind: null,
  turnFailure: null,
  message: null,
} satisfies Partial<VoiceState>);

/** Back to idle with the words kept on screen: the turn is no longer running. */
const AT_REST = Object.freeze({
  phase: 'idle',
  replyStreaming: false,
  toolCaption: null,
  holdStartedAt: null,
  bargedIn: false,
  errorKind: null,
  turnFailure: null,
} satisfies Partial<VoiceState>);

/** The state with these changes, or the same object when none of them changes anything. */
function patch(state: VoiceState, changes: Partial<VoiceState>): VoiceState {
  const keys = Object.keys(changes) as (keyof VoiceState)[];
  return keys.some((key) => state[key] !== changes[key]) ? { ...state, ...changes } : state;
}

function holdStart(state: VoiceState, event: EventOf<'hold_start'>): VoiceState {
  if (state.phase === 'listening') return state;
  if (state.phase === 'error' && !isRetryable(state.errorKind)) return state;
  return patch(state, {
    ...NEW_TURN,
    phase: 'listening',
    holdStartedAt: event.now,
    bargedIn: REPLYING.has(state.phase),
  });
}

function partial(state: VoiceState, event: EventOf<'partial'>): VoiceState {
  return state.phase === 'listening' ? patch(state, { heard: event.text }) : state;
}

/** The hold ended without a turn: nothing sent, the hint (if any) under the core. */
function endHold(state: VoiceState, message: VoiceMessage | null): VoiceState {
  if (state.phase !== 'listening') return state;
  return patch(state, { ...AT_REST, heard: '', message });
}

function final(state: VoiceState, event: EventOf<'final'>): VoiceState {
  if (state.phase !== 'listening') return state;
  if (!hasWords(event.text)) return endHold(state, 'nothingHeard');
  return patch(state, {
    phase: 'thinking',
    heard: event.text.trim(),
    holdStartedAt: null,
    bargedIn: false,
    message: null,
  });
}

function sent(state: VoiceState, event: EventOf<'sent'>): VoiceState {
  if (state.phase !== 'thinking' || state.replyStreaming || state.replyFinished) return state;
  return patch(state, { replyStreaming: true, notice: event.notice ?? null });
}

function turnText(state: VoiceState, event: EventOf<'turn_text'>): VoiceState {
  return REPLYING.has(state.phase) ? patch(state, { reply: event.text }) : state;
}

function turnTool(state: VoiceState, event: EventOf<'turn_tool'>): VoiceState {
  return REPLYING.has(state.phase) ? patch(state, { toolCaption: event.caption }) : state;
}

function turnFinished(state: VoiceState): VoiceState {
  if (!REPLYING.has(state.phase) || state.replyFinished) return state;
  const done = { replyStreaming: false, replyFinished: true, toolCaption: null };
  // Nothing to speak: no speak_start will come, so Auto is done.
  if (state.phase === 'thinking' && !hasWords(state.reply))
    return patch(state, { ...AT_REST, ...done });
  return patch(state, done);
}

function turnFailed(state: VoiceState, event: EventOf<'turn_failed'>): VoiceState {
  if (!REPLYING.has(state.phase)) return state;
  return patch(state, { ...AT_REST, phase: 'error', errorKind: 'turn', turnFailure: event.kind });
}

/** The failed turn's read had only broken: Auto has the turn again, its words still to come. */
function turnResumed(state: VoiceState): VoiceState {
  if (state.phase !== 'error' || state.errorKind !== 'turn') return state;
  return patch(state, {
    phase: 'thinking',
    replyStreaming: true,
    replyFinished: false,
    errorKind: null,
    turnFailure: null,
    message: null,
  });
}

function speakStart(state: VoiceState): VoiceState {
  return REPLYING.has(state.phase) ? patch(state, { phase: 'speaking' }) : state;
}

/** The speaker's queue ran out: done when the turn finished, else Auto is still working. */
function speakDone(state: VoiceState): VoiceState {
  if (!REPLYING.has(state.phase)) return state;
  return state.replyFinished ? patch(state, AT_REST) : patch(state, { phase: 'thinking' });
}

function stop(state: VoiceState): VoiceState {
  return patch(state, { ...AT_REST, micOpen: false, message: null });
}

/** The phone cannot take the hold: error with its kind, a reply under way left alone. */
function refuse(state: VoiceState, errorKind: VoiceState['errorKind']): VoiceState {
  if (REPLYING.has(state.phase)) return state;
  return patch(state, { ...AT_REST, phase: 'error', errorKind, message: null });
}

function recognizerFailed(state: VoiceState, event: EventOf<'error'>): VoiceState {
  // A late error after STOP or a release belongs to a hold that is over.
  return state.phase === 'listening' ? refuse(state, event.kind) : state;
}

function permission(state: VoiceState, event: EventOf<'permission'>): VoiceState {
  switch (event.step) {
    case 'ask':
      return state;
    case 'granted':
      // The prompt interrupted the hold that raised it: that hold is not speech (US-019c).
      if (REPLYING.has(state.phase)) return state;
      return patch(state, { ...AT_REST, heard: '', message: 'ready' });
    default:
      return refuse(
        state,
        event.step === 'settings' ? 'permission-settings' : 'permission-restricted',
      );
  }
}

function interrupted(state: VoiceState, event: EventOf<'interrupted'>): VoiceState {
  return patch(state, { ...AT_REST, micOpen: false, message: INTERRUPT_MESSAGES[event.reason] });
}

function reset(state: VoiceState): VoiceState {
  // The capture is the recognizer's truth: a reset never closes a mic that is still open.
  return state.micOpen
    ? patch(state, { ...INITIAL_VOICE_STATE, micOpen: true })
    : INITIAL_VOICE_STATE;
}

const HANDLERS: Handlers = {
  hold_start: holdStart,
  mic_open: (state) => patch(state, { micOpen: true }),
  partial,
  mic_closed: (state) => patch(state, { micOpen: false }),
  final,
  hold_too_short: (state) => endHold(state, 'holdHint'),
  nothing_heard: (state) => endHold(state, 'nothingHeard'),
  stop_phrase: (state) => endHold(state, null),
  sent,
  turn_text: turnText,
  turn_tool: turnTool,
  turn_finished: turnFinished,
  turn_failed: turnFailed,
  turn_resumed: turnResumed,
  speak_start: speakStart,
  speak_done: speakDone,
  stop,
  error: recognizerFailed,
  unavailable: (state, event) => refuse(state, event.reason),
  permission,
  interrupted,
  reset,
};

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  if (!Object.prototype.hasOwnProperty.call(HANDLERS, event.type)) return state;
  // TypeScript cannot correlate HANDLERS[type] with the narrowed event; the mapped type checks each entry.
  const handle = HANDLERS[event.type] as Handler<VoiceEvent['type']>;
  return handle(state, event);
}
