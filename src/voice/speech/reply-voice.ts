// The voice Auto's replies are spoken in (27 Oct 2026): the server's (server-speaker.ts) when the
// speech asks for it, else the phone's (speaker-core.ts), as one speaker with one listener stack.
// Pure: no React, React Native or Expo. voice-out.ts binds it to the phone's speaker and the
// server voice; quick-ask and Settings → Voice speak only through it.
//   Per sentence: options.server (the server lists tts and the person keeps Auto's voice, set by
//   the hook) sends it to the server voice, unless this turn has fallen back; anything else goes to
//   the phone's voice exactly as before the server voice existed.
//   Fallback: when the server voice fails, the sentence that failed and every one queued after it
//   are handed to the phone's voice, and so is every later sentence of the turn. newTurn() (quick-
//   ask's send) and stop() (STOP, barge-in, leaving the screen, a failed or stopped turn) let the
//   next turn try the server again; a newTurn() mid-run takes effect once that run is over.
//   Events, folded into the phone speaker's three: speak_start once per run, whichever voice
//   starts it; speak_done when the run's last sentence has ended, in whichever voice; stopped when
//   stop() cut a run short (said here, once: the two speakers' own stops are not passed on).

import { createListenerStack, type ListenerStack } from '../audio/listener-stack';
import type { ServerSpeaker, ServerSpeakerEvent } from '../server/server-speaker-ports';
import type { SpeakOptions, Speaker, SpeakerEvent } from './speaker-core';

export type ReplyVoice = Speaker & {
  /** A new turn: its sentences try the server voice again (when the speech asks for it). */
  readonly newTurn: () => void;
};

type Mode = 'server' | 'phone';

type State = {
  readonly mode: Mode;
  /** A run is under way: spoken, queued or waiting for the server. */
  readonly busy: boolean;
  readonly started: boolean;
  /** newTurn() came mid-run: the mode goes back to 'server' when the run is over. */
  readonly resetAfterRun: boolean;
  /** The last sentence's options: the phone's voice speaks a fallen-back turn with them. */
  readonly options: SpeakOptions | null;
};

const IDLE: State = Object.freeze({
  mode: 'server',
  busy: false,
  started: false,
  resetAfterRun: false,
  options: null,
});

const START: SpeakerEvent = Object.freeze({ type: 'speak_start' });
const DONE: SpeakerEvent = Object.freeze({ type: 'speak_done' });
const STOPPED: SpeakerEvent = Object.freeze({ type: 'stopped' });

/** The phone's speaker, and the server voice made with the reply voice's event handler. */
export type ReplyVoiceParts = {
  readonly phone: Speaker;
  readonly server: (emit: (event: ServerSpeakerEvent) => void) => ServerSpeaker;
};

type Ctx = {
  readonly phone: Speaker;
  readonly listeners: ListenerStack<SpeakerEvent>;
  readonly cell: { state: State };
};

function set(ctx: Ctx, changes: Partial<State>): void {
  ctx.cell.state = { ...ctx.cell.state, ...changes };
}

/** A run's first sound, in either voice: speak_start, once. */
function started(ctx: Ctx): void {
  const { busy, started: already } = ctx.cell.state;
  if (!busy || already) return;
  set(ctx, { started: true });
  ctx.listeners.emit(START);
}

/** The run's last sentence ended, in either voice: speak_done, and a pending newTurn() applies. */
function done(ctx: Ctx): void {
  const { busy, resetAfterRun, mode } = ctx.cell.state;
  if (!busy) return;
  set(ctx, {
    mode: resetAfterRun ? 'server' : mode,
    busy: false,
    started: false,
    resetAfterRun: false,
  });
  ctx.listeners.emit(DONE);
}

/** The server voice failed: the rest of the turn in the phone's voice. */
function fallBack(ctx: Ctx, rest: readonly string[]): void {
  set(ctx, { mode: 'phone' });
  const { options } = ctx.cell.state;
  if (rest.length === 0 || options === null) return done(ctx);
  rest.forEach((sentence) => ctx.phone.speak(sentence, options));
}

function onServer(ctx: Ctx, event: ServerSpeakerEvent): void {
  if (event.type === 'speak_start') return started(ctx);
  if (event.type === 'speak_done') return done(ctx);
  fallBack(ctx, event.rest);
}

export function createReplyVoice({ phone, server: makeServer }: ReplyVoiceParts): ReplyVoice {
  const ctx: Ctx = {
    phone,
    listeners: createListenerStack<SpeakerEvent>('reply voice'),
    cell: { state: IDLE },
  };
  phone.listen((event) => {
    if (event.type === 'speak_start') started(ctx);
    else if (event.type === 'speak_done') done(ctx);
  });
  const server = makeServer((event) => onServer(ctx, event));

  function speak(sentence: string, options: SpeakOptions): void {
    if (!sentence.trim()) return;
    set(ctx, { busy: true, options });
    if (options.server && ctx.cell.state.mode === 'server') server.speak(sentence, options.server);
    else phone.speak(sentence, options);
  }

  function stop(): void {
    const cutShort = ctx.cell.state.busy;
    ctx.cell.state = IDLE;
    server.stop();
    phone.stop();
    if (cutShort) ctx.listeners.emit(STOPPED);
  }

  return Object.freeze({
    voices: phone.voices,
    voiceFor: phone.voiceFor,
    choicesFor: phone.choicesFor,
    speak,
    stop,
    newTurn: () => set(ctx, ctx.cell.state.busy ? { resetAfterRun: true } : { mode: 'server' }),
    listen: ctx.listeners.push,
  });
}
