// Auto's server voice, one sentence at a time (27 Oct 2026): each sentence's MP3 is asked of the
// server, written to the cache and played, over ports (server-speaker-ports.ts; server-voice.ts
// binds them to the API client, expo-file-system and expo-audio, the tests to fakes). Pure: no
// React, React Native or Expo. One cell holds the state, replaced whole on every change.
//   The queue: one request in flight at a time. While a sentence plays, the next one is fetched
//   (prefetch: the gap between them is only the player's start), and the one after waits for its
//   turn. A sentence is due when nothing plays before it; from then it has SERVER_VOICE_WAIT_MS to
//   be ready, so a prefetched sentence's synthesis runs under the playback before it. A sentence
//   over the server's 500 characters goes in pieces split at a space.
//   Events: speak_start when the run's first file starts playing, speak_done when the last queued
//   sentence has ended, and failed on the first thing that goes wrong (the server's refusal, a
//   network error, the wait running out, a file that cannot be written, a player that does not
//   start or stalls). failed hands over the sentence that failed and every one after it, for the
//   phone's voice (reply-voice.ts), and the run is over. Its log names the kind, never the text.
//   stop() ends the run at once: the player stopped and released, every request aborted, every
//   file deleted. A new generation, so a late answer, callback or timer of the old run does
//   nothing. The audio session is set for playback once per run, before its first file plays; a
//   session that is not set within SERVER_PLAY_START_MS is a play error like a player that does not
//   start. A file that ends before its player said it was playing still says speak_start first.

import { logger } from '../../lib/logger';
import {
  SERVER_PLAY_END_SLACK_MS,
  SERVER_PLAY_MAX_MS,
  SERVER_PLAY_START_MS,
  SERVER_SPEECH_MAX_CHARS,
  SERVER_VOICE_WAIT_MS,
} from '../config';
import { fitToEngine } from '../speech/speaker-core';
import type {
  PlayHandlers,
  ServerFailureKind,
  ServerSpeaker,
  ServerSpeakerEvent,
  ServerSpeakerPorts,
  ServerSpeech,
} from './server-speaker-ports';
import { SpeechFailure } from './voice-api';

type Item = {
  readonly id: number;
  readonly text: string;
  readonly server: ServerSpeech;
  readonly status: 'waiting' | 'fetching' | 'ready' | 'failed';
  readonly uri?: string;
  readonly failure?: ServerFailureKind;
  /** Aborts its request. */
  readonly abort?: () => void;
  /** Cancels its wait (armed once it falls due). */
  readonly stopWait?: () => void;
};

type Playing = {
  readonly item: Item;
  readonly stop: () => void;
  readonly stopWatch: () => void;
  /** The player said it is playing. */
  readonly started: boolean;
};

type Inner = {
  /** Bumped by every teardown: callbacks of an older generation do nothing. */
  readonly generation: number;
  readonly ids: number;
  /** Sentences not yet playing, in order; the first is due when nothing plays. */
  readonly queue: readonly Item[];
  readonly current: Playing | null;
  readonly active: boolean;
  readonly started: boolean;
  /** This run's audio session, set once before its first file plays. */
  readonly prepared: Promise<void>;
};

type Ctx = {
  readonly ports: ServerSpeakerPorts;
  readonly emit: (event: ServerSpeakerEvent) => void;
  readonly cell: { current: Inner };
};

const NOOP = (): void => undefined;

const get = (ctx: Ctx): Inner => ctx.cell.current;
const live = (ctx: Ctx, gen: number): boolean => get(ctx).generation === gen;
const find = (ctx: Ctx, id: number): Item | undefined =>
  get(ctx).queue.find((item) => item.id === id);
const playingNow = (ctx: Ctx, gen: number, id: number): boolean =>
  live(ctx, gen) && get(ctx).current?.item.id === id;

function set(ctx: Ctx, changes: Partial<Inner>): void {
  ctx.cell.current = { ...get(ctx), ...changes };
}

function update(ctx: Ctx, id: number, changes: Partial<Item>): void {
  set(ctx, {
    queue: get(ctx).queue.map((item) => (item.id === id ? { ...item, ...changes } : item)),
  });
}

function kindOf(error: unknown): ServerFailureKind {
  return error instanceof SpeechFailure ? error.kind : 'network';
}

/** The end watchdog: the file's length and some slack, or the most a file may play. */
function endLimit(durationSeconds: number): number {
  if (!(durationSeconds > 0)) return SERVER_PLAY_MAX_MS;
  return durationSeconds * 1000 + SERVER_PLAY_END_SLACK_MS;
}

function release(ctx: Ctx, playing: Playing): void {
  playing.stopWatch();
  playing.stop();
  if (playing.item.uri) ctx.ports.files.remove(playing.item.uri);
}

/** The run is over: every request aborted, every timer cancelled, every file deleted. */
function teardown(ctx: Ctx): void {
  const { queue, current, generation } = get(ctx);
  set(ctx, { generation: generation + 1, queue: [], current: null, active: false, started: false });
  queue.forEach((item) => {
    item.abort?.();
    item.stopWait?.();
    if (item.uri) ctx.ports.files.remove(item.uri);
  });
  if (current) release(ctx, current);
}

function fail(ctx: Ctx, kind: ServerFailureKind): void {
  const { queue, current } = get(ctx);
  const rest = [...(current ? [current.item.text] : []), ...queue.map((item) => item.text)];
  teardown(ctx);
  logger.warn(`[voice] the server voice failed (${kind}); the phone's voice speaks the rest`);
  ctx.emit(Object.freeze({ type: 'failed', kind, rest: Object.freeze(rest) }));
}

function finishRun(ctx: Ctx): void {
  if (!get(ctx).active) return;
  set(ctx, { active: false, started: false });
  ctx.emit(Object.freeze({ type: 'speak_done' }));
}

/** The sentence's wait (if armed) is over: it is ready, or it failed. */
function settle(ctx: Ctx, id: number, changes: Partial<Item>): void {
  find(ctx, id)?.stopWait?.();
  update(ctx, id, { ...changes, stopWait: undefined });
  pump(ctx);
}

function written(ctx: Ctx, bytes: Uint8Array): string | null {
  try {
    return ctx.ports.files.write(bytes);
  } catch (error) {
    logger.warn('[voice] the server voice could not be saved for playing', error);
    return null;
  }
}

function fetched(ctx: Ctx, gen: number, id: number, bytes: Uint8Array): void {
  if (!live(ctx, gen) || !find(ctx, id)) return;
  const uri = written(ctx, bytes);
  settle(ctx, id, uri === null ? { status: 'failed', failure: 'file' } : { status: 'ready', uri });
}

function fetchItem(ctx: Ctx, item: Item): void {
  const controller = new AbortController();
  const gen = get(ctx).generation;
  update(ctx, item.id, { status: 'fetching', abort: () => controller.abort() });
  ctx.ports.fetchSpeech(item.server, item.text, controller.signal).then(
    (bytes) => fetched(ctx, gen, item.id, bytes),
    (error: unknown) => {
      if (live(ctx, gen) && find(ctx, item.id))
        settle(ctx, item.id, { status: 'failed', failure: kindOf(error) });
    },
  );
}

/** The due sentence has SERVER_VOICE_WAIT_MS to be ready; armed once. */
function armWait(ctx: Ctx, id: number): void {
  const item = find(ctx, id);
  if (!item || item.stopWait || item.status === 'ready') return;
  const gen = get(ctx).generation;
  const waited = (): void => {
    const waiting = live(ctx, gen) ? find(ctx, id) : undefined;
    if (waiting && waiting.status !== 'ready') fail(ctx, 'timeout');
  };
  update(ctx, id, { stopWait: ctx.ports.later(waited, SERVER_VOICE_WAIT_MS) });
}

function watchdog(ctx: Ctx, gen: number, id: number, ms: number, kind: ServerFailureKind) {
  return ctx.ports.later(() => {
    if (playingNow(ctx, gen, id)) fail(ctx, kind);
  }, ms);
}

function playing(ctx: Ctx, gen: number, id: number, durationSeconds: number): void {
  const { current, started } = get(ctx);
  if (!playingNow(ctx, gen, id) || !current || current.started) return;
  current.stopWatch();
  const stopWatch = watchdog(ctx, gen, id, endLimit(durationSeconds), 'play_stalled');
  set(ctx, { current: { ...current, stopWatch, started: true }, started: true });
  if (!started) ctx.emit(Object.freeze({ type: 'speak_start' }));
}

function ended(ctx: Ctx, gen: number, id: number): void {
  // A clip too short for a 'playing' update still started: speak_start before its end.
  if (get(ctx).current?.started === false) playing(ctx, gen, id, 0);
  const { current } = get(ctx);
  if (!playingNow(ctx, gen, id) || !current) return;
  set(ctx, { current: null });
  release(ctx, current);
  pump(ctx);
}

function handlersFor(ctx: Ctx, gen: number, id: number): PlayHandlers {
  return {
    onPlaying: (seconds) => playing(ctx, gen, id, seconds),
    onEnded: () => ended(ctx, gen, id),
    onError: () => {
      if (playingNow(ctx, gen, id)) fail(ctx, 'play_error');
    },
  };
}

function startAudio(ctx: Ctx, gen: number, item: Item): void {
  get(ctx).current?.stopWatch();
  const stopWatch = watchdog(ctx, gen, item.id, SERVER_PLAY_START_MS, 'play_error');
  set(ctx, { current: { item, stop: NOOP, stopWatch, started: false } });
  try {
    const handle = ctx.ports.audio.play(item.uri ?? '', handlersFor(ctx, gen, item.id));
    const { current } = get(ctx);
    // A player that ended (or failed) inside play() is released at once.
    if (current && playingNow(ctx, gen, item.id)) set(ctx, { current: { ...current, ...handle } });
    else handle.stop();
  } catch (error) {
    logger.warn('[voice] the server voice could not play', error);
    if (playingNow(ctx, gen, item.id)) fail(ctx, 'play_error');
  }
}

async function playHead(ctx: Ctx, head: Item): Promise<void> {
  const { generation: gen, queue, prepared } = get(ctx);
  head.stopWait?.();
  // Holds the slot while the audio session is set, so nothing else starts meanwhile; a session
  // that never settles is a play error, not a run that hangs.
  const stopWatch = watchdog(ctx, gen, head.id, SERVER_PLAY_START_MS, 'play_error');
  set(ctx, {
    queue: queue.slice(1),
    current: { item: head, stop: NOOP, stopWatch, started: false },
  });
  await prepared;
  if (!live(ctx, gen)) return;
  startAudio(ctx, gen, head);
  pump(ctx);
}

/** Nothing plays: the head plays when ready, else is fetched and waited for. */
function advance(ctx: Ctx, head: Item): void {
  if (head.status === 'failed') return fail(ctx, head.failure ?? 'network');
  if (head.status === 'ready') return void playHead(ctx, head);
  if (head.status === 'waiting') fetchItem(ctx, head);
  armWait(ctx, head.id);
}

function pump(ctx: Ctx): void {
  const { queue, current } = get(ctx);
  const head = queue[0];
  if (current === null) return head ? advance(ctx, head) : finishRun(ctx);
  // One ahead: the next sentence is fetched while this one plays.
  if (head?.status === 'waiting') fetchItem(ctx, head);
}

function prepare(ctx: Ctx): Promise<void> {
  return ctx.ports.audio
    .prepare()
    .catch((error: unknown) => logger.warn('[voice] the audio session was not set', error));
}

function speak(ctx: Ctx, text: string, server: ServerSpeech): void {
  const pieces = fitToEngine(text, SERVER_SPEECH_MAX_CHARS);
  if (pieces.length === 0) return;
  const { active, ids, queue, prepared } = get(ctx);
  const added = pieces.map((piece, index): Item => {
    return { id: ids + index + 1, text: piece, server, status: 'waiting' };
  });
  set(ctx, {
    active: true,
    ids: ids + pieces.length,
    queue: [...queue, ...added],
    prepared: active ? prepared : prepare(ctx),
  });
  pump(ctx);
}

export function createServerSpeaker(
  ports: ServerSpeakerPorts,
  emit: (event: ServerSpeakerEvent) => void,
): ServerSpeaker {
  const ctx: Ctx = {
    ports,
    emit,
    cell: {
      current: {
        generation: 0,
        ids: 0,
        queue: [],
        current: null,
        active: false,
        started: false,
        prepared: Promise.resolve(),
      },
    },
  };
  return Object.freeze({
    speak: (text: string, server: ServerSpeech) => speak(ctx, text, server),
    stop: () => {
      if (get(ctx).active) teardown(ctx);
    },
    busy: () => get(ctx).active,
  });
}
