// Quick-ask on HUD's home (US-019k), pure: what A5's core shows of the voice when HOLD TO TALK works
// in place. No React, React Native or Expo; every word still comes from the one reducer through
// voiceView (KV8), and the home's own (A5's hudTurn, Auto's chip) stands wherever the voice is quiet.
//   The transcript: the voice's turn (the words heard as they come, Auto's reply with the AI notice
//   above it once per session, KV7) from a press until a typed send makes the thread's turn the
//   newest again; a press that heard nothing (a tap, a refusal) leaves the thread's turn on screen.
//   Once the voice's turn is sent it is the thread's newest exchange, so the status row's clock and
//   the answering agent come from the thread's turn. Report this names the voice's own saved reply
//   (replyId, by where its turn started), never the thread's newest, which a typed send may be.
//   The chip and the status word: the voice's while it works (the mic held, Auto thinking or
//   speaking) or while the voice's turn has a line to say; Auto's state's (A5's) otherwise.
//   The line under the chip: the view-model's, but for the two that have no place here: a viewer's
//   (HOLD TO TALK is off and says why; TYPE's sheet carries the read-only words, D17) and 'See it in
//   the chat' (HUD's conversation is this same screen).
//   STOP: on while the voice works or a typed turn streams; quick-ask's STOP always (the mic, the
//   speech, its own turn), and A2's Stop too unless quick-ask's own turn streams (it cancels that).

import type { ChipView, HudTalk, HudTurn } from '../../styles/hud/core/model';
import type { VoicePhase, VoiceState } from '../machine/voice-state';
import type { QuickAskReply } from '../quick-ask/reply-text';
import {
  talkProps,
  voiceChip,
  voiceLine,
  voiceTurn,
  type HoldHandlers,
  type VoiceLine,
} from '../screen/core-props';
import type { MessageKind, VoiceView } from '../screen/voice-view-model';

/** Whose turn is the newest on the home: the voice's from a press, the thread's from a typed send. */
export type HomeShows = 'thread' | 'voice';

export type HudHomeVoiceInput = {
  readonly view: VoiceView;
  readonly state: VoiceState;
  /** Quick-ask's last reply (the snapshot's): its agent. */
  readonly reply: QuickAskReply | null;
  /** HUD's home's own turn over the thread (A5's hudTurn). */
  readonly threadTurn: HudTurn;
  readonly shows: HomeShows;
  /** A turn streams on the thread (A2's canStop): a typed one STOP stops as well. */
  readonly threadStreams: boolean;
  readonly hold: HoldHandlers;
  /** The voice's saved reply where Report this is offered on it (voiceReportId); null before. */
  readonly replyId: string | null;
};

export type HudHomeVoice = {
  readonly turn: HudTurn;
  /** MIC LIVE: the recognizer's capture (KV5). */
  readonly micOpen: boolean;
  readonly talk: HudTalk;
  readonly stopEnabled: boolean;
  /** The voice's chip and status word; undefined while the home's own stands. */
  readonly chip: ChipView | undefined;
  readonly line: VoiceLine | null;
};

/** The mic is held or Auto has the voice's turn. */
const WORKING: ReadonlySet<VoicePhase> = new Set<VoicePhase>(['listening', 'thinking', 'speaking']);

/** The view-model's lines with no place on HUD's home. */
const NOT_HERE: ReadonlySet<MessageKind> = new Set<MessageKind>(['viewer', 'chat']);

export function voiceWorks(state: VoiceState): boolean {
  return state.micOpen || WORKING.has(state.phase);
}

/** The line under the chip: the view-model's, but a viewer's and 'See it in the chat'. */
export function homeLine(view: VoiceView): VoiceLine | null {
  const { message } = view;
  return message === null || NOT_HERE.has(message.kind) ? null : voiceLine(message);
}

function hasTurn(turn: HudTurn): boolean {
  return turn.you !== null || turn.auto !== null || turn.streaming;
}

/** The transcript's turn: the voice's while it is the newest and has words, else the thread's. */
export function homeTurn(input: HudHomeVoiceInput): HudTurn {
  const { view, state, reply, threadTurn, shows } = input;
  if (shows !== 'voice') return threadTurn;
  const spoken = voiceTurn(view, reply, input.replyId);
  if (!hasTurn(spoken)) return threadTurn;
  if (!state.replyStreaming && !state.replyFinished) return spoken;
  return Object.freeze({
    ...threadTurn,
    you: spoken.you ?? threadTurn.you,
    auto: spoken.auto,
    streaming: spoken.streaming,
    // the id goes with the words: the voice's reply, never the thread's turn's
    autoMessageId: spoken.autoMessageId,
    agent: spoken.agent ?? threadTurn.agent,
  });
}

/** STOP on the home stops A2's turn too unless quick-ask's own streams (quick-ask cancels that). */
export function stopsThread(state: VoiceState): boolean {
  return !state.replyStreaming;
}

export function hudHomeVoice(input: HudHomeVoiceInput): HudHomeVoice {
  const { view, state, shows } = input;
  const line = homeLine(view);
  const speaks = voiceWorks(state) || (shows === 'voice' && line !== null);
  return Object.freeze({
    turn: homeTurn(input),
    micOpen: view.mic === 'live',
    talk: talkProps(view, state.phase, input.hold),
    stopEnabled: view.stop.enabled || input.threadStreams,
    chip: speaks ? voiceChip(view) : undefined,
    line: speaks ? line : null,
  });
}
