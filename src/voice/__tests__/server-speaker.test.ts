// The server speaker over fake ports: sentences play in order, each fetched while the one before
// it plays (one request in flight, none further ahead), with no gap when the next one is ready;
// speak_start once, speak_done after the last; stop() stops the player, aborts every request and
// deletes every file; and every failure (each refusal, the wait, the file, the player) hands the
// failed sentence and the rest over, logging the kind only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import {
  SERVER_PLAY_END_SLACK_MS,
  SERVER_PLAY_MAX_MS,
  SERVER_PLAY_START_MS,
  SERVER_SPEECH_MAX_CHARS,
  SERVER_VOICE_WAIT_MS,
} from '../config';
import { createServerSpeaker } from '../server/server-speaker';
import type { ServerSpeakerEvent, ServerSpeakerPorts } from '../server/server-speaker-ports';
import { SpeechFailure, type SpeechFailureKind } from '../server/voice-api';
import { SERVER_SPEECH, fakeServerPorts, settle } from './server-ports';

function speakerOver(overrides: Partial<ServerSpeakerPorts['audio']> = {}) {
  const fake = fakeServerPorts();
  const events: ServerSpeakerEvent[] = [];
  const ports = { ...fake.ports, audio: { ...fake.ports.audio, ...overrides } };
  const speaker = createServerSpeaker(ports, (event) => events.push(event));
  const types = () => events.map((event) => event.type);
  return { ...fake, speaker, events, types };
}

/** Answers request `index` and lets its file reach the player. */
async function answer(h: ReturnType<typeof speakerOver>, index: number): Promise<void> {
  h.requests[index]?.answer();
  await settle();
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the queue', () => {
  it('fetches only the due sentence, then the next one while it plays, in order', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    h.speaker.speak('Three.', SERVER_SPEECH);
    expect(h.requests.map((request) => request.text)).toEqual(['One.']);
    await answer(h, 0);
    expect(h.players.map((player) => player.uri)).toEqual(['file:///cache/server-voice/1.mp3']);
    expect(h.requests.map((request) => request.text)).toEqual(['One.', 'Two.']);
    expect(h.inFlight()).toHaveLength(1);
    await answer(h, 1);
    // Two is ready while One plays: Three is not asked for yet (one ahead at most).
    expect(h.requests).toHaveLength(2);
    expect(h.players).toHaveLength(1);
    h.playerOf(0).handlers.onPlaying(2);
    h.playerOf(0).handlers.onEnded();
    await settle();
    // No gap: Two plays as One ends, and Three is fetched under it.
    expect(h.players.map((player) => player.uri)).toEqual([
      'file:///cache/server-voice/1.mp3',
      'file:///cache/server-voice/2.mp3',
    ]);
    expect(h.requests.map((request) => request.text)).toEqual(['One.', 'Two.', 'Three.']);
    expect(h.playerOf(0).stopped).toBe(true);
    expect(h.removed).toEqual(['file:///cache/server-voice/1.mp3']);
  });

  it('never has more than one request in flight', async () => {
    const h = speakerOver();
    ['A.', 'B.', 'C.', 'D.'].forEach((text) => h.speaker.speak(text, SERVER_SPEECH));
    for (let index = 0; index < 4; index += 1) {
      expect(h.inFlight().length).toBeLessThanOrEqual(1);
      await answer(h, index);
      expect(h.inFlight().length).toBeLessThanOrEqual(1);
      h.playerOf(index).handlers.onPlaying(1);
      h.playerOf(index).handlers.onEnded();
      await settle();
    }
    expect(h.players.map((player) => player.uri)).toHaveLength(4);
    expect(h.types()).toEqual(['speak_start', 'speak_done']);
  });

  it('says speak_start at the first sound and speak_done after the last sentence ends', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    expect(h.types()).toEqual([]);
    h.playerOf(0).handlers.onPlaying(1);
    h.playerOf(0).handlers.onPlaying(1);
    expect(h.types()).toEqual(['speak_start']);
    h.speaker.speak('Two.', SERVER_SPEECH);
    h.playerOf(0).handlers.onEnded();
    await answer(h, 1);
    h.playerOf(1).handlers.onPlaying(1);
    h.playerOf(1).handlers.onEnded();
    await settle();
    expect(h.types()).toEqual(['speak_start', 'speak_done']);
    expect(h.speaker.busy()).toBe(false);
  });

  it('sets the audio session once per run, before the first file plays', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    expect(h.prepare).toHaveBeenCalledTimes(1);
    await answer(h, 0);
    h.playerOf(0).handlers.onEnded();
    await answer(h, 1);
    h.playerOf(1).handlers.onEnded();
    await settle();
    h.speaker.speak('Next run.', SERVER_SPEECH);
    expect(h.prepare).toHaveBeenCalledTimes(2);
  });

  it('asks in pieces of at most 500 characters, split at a space', async () => {
    const h = speakerOver();
    const long = `${'word '.repeat(150)}end.`;
    h.speaker.speak(long, SERVER_SPEECH);
    await answer(h, 0);
    h.playerOf(0).handlers.onEnded();
    await answer(h, 1);
    const asked = h.requests.map((request) => request.text);
    expect(asked).toHaveLength(2);
    asked.forEach((text) => expect(text.length).toBeLessThanOrEqual(SERVER_SPEECH_MAX_CHARS));
    expect(asked.join(' ')).toBe(long.trim());
  });

  it('ignores a blank sentence', () => {
    const h = speakerOver();
    h.speaker.speak('   ', SERVER_SPEECH);
    expect(h.requests).toEqual([]);
    expect(h.speaker.busy()).toBe(false);
  });

  it('sends the voice and speed it was given', () => {
    const h = speakerOver();
    const server = { ...SERVER_SPEECH, voice: null, speed: 0.85 };
    h.speaker.speak('One.', server);
    expect(h.requests[0]?.server).toBe(server);
  });
});

describe('stop', () => {
  it('stops the player, aborts every request and deletes every file', async () => {
    const h = speakerOver();
    ['One.', 'Two.', 'Three.'].forEach((text) => h.speaker.speak(text, SERVER_SPEECH));
    await answer(h, 0);
    h.playerOf(0).handlers.onPlaying(3);
    h.speaker.stop();
    expect(h.playerOf(0).stopped).toBe(true);
    expect(h.requests[1]?.signal.aborted).toBe(true);
    expect(h.removed).toEqual(['file:///cache/server-voice/1.mp3']);
    expect(h.speaker.busy()).toBe(false);
    expect(h.timers.filter((timer) => !timer.cancelled && !timer.fired)).toEqual([]);
  });

  it('a late answer, end or timer of the stopped run does nothing', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    await answer(h, 0);
    h.speaker.stop();
    await answer(h, 1);
    h.playerOf(0).handlers.onPlaying(1);
    h.playerOf(0).handlers.onEnded();
    h.fire(SERVER_PLAY_START_MS);
    h.fire(SERVER_VOICE_WAIT_MS);
    await settle();
    expect(h.players).toHaveLength(1);
    expect(h.written).toHaveLength(1);
    expect(h.events).toEqual([]);
  });

  it('cancels a request still waiting for its audio session', async () => {
    const h = speakerOver();
    let setSession: () => void = () => undefined;
    h.prepare.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          setSession = () => resolve(undefined);
        }),
    );
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    h.speaker.stop();
    setSession();
    await settle();
    expect(h.players).toEqual([]);
    expect(h.removed).toEqual(['file:///cache/server-voice/1.mp3']);
  });

  it('does nothing when nothing is under way', () => {
    const h = speakerOver();
    h.speaker.stop();
    expect(h.events).toEqual([]);
  });
});

const REFUSALS: readonly SpeechFailureKind[] = [
  'tts_off',
  'tts_unavailable',
  'tts_bad_request',
  'tts_too_long',
  'tts_busy',
  'network',
  'auth',
  'refused',
  'invalid_audio',
];

describe('failures hand the sentence and the rest over', () => {
  it.each(REFUSALS)('%s on the due sentence', async (kind) => {
    const h = speakerOver();
    const warn = vi.mocked(logger.warn);
    ['First words.', 'Second.', 'Third.'].forEach((text) => h.speaker.speak(text, SERVER_SPEECH));
    h.requests[0]?.refuse(new SpeechFailure(kind));
    await settle();
    expect(h.events).toEqual([
      { type: 'failed', kind, rest: ['First words.', 'Second.', 'Third.'] },
    ]);
    expect(h.players).toEqual([]);
    expect(h.speaker.busy()).toBe(false);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain(kind);
    expect(logged).not.toContain('First words');
  });

  it('a prefetched refusal waits for the sentence before it to finish', async () => {
    const h = speakerOver();
    ['One.', 'Two.', 'Three.'].forEach((text) => h.speaker.speak(text, SERVER_SPEECH));
    await answer(h, 0);
    h.playerOf(0).handlers.onPlaying(2);
    h.requests[1]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    expect(h.types()).toEqual(['speak_start']);
    expect(h.playerOf(0).stopped).toBe(false);
    h.playerOf(0).handlers.onEnded();
    await settle();
    expect(h.events.at(-1)).toEqual({ type: 'failed', kind: 'tts_busy', rest: ['Two.', 'Three.'] });
  });

  it('an unknown error is a network failure', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.requests[0]?.refuse(new TypeError('offline'));
    await settle();
    expect(h.events).toEqual([{ type: 'failed', kind: 'network', rest: ['One.'] }]);
  });

  it('times out when the due sentence is not ready within the wait, aborting it', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    h.fire(SERVER_VOICE_WAIT_MS);
    expect(h.events).toEqual([{ type: 'failed', kind: 'timeout', rest: ['One.', 'Two.'] }]);
    expect(h.requests[0]?.signal.aborted).toBe(true);
  });

  it('starts a prefetched sentence’s wait only when it falls due', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    await answer(h, 0);
    h.playerOf(0).handlers.onPlaying(8);
    // Two's synthesis runs under One's playback: no wait is armed for it yet.
    expect(
      h.timers.filter((timer) => timer.ms === SERVER_VOICE_WAIT_MS && !timer.cancelled),
    ).toEqual([]);
    h.playerOf(0).handlers.onEnded();
    await settle();
    h.fire(SERVER_VOICE_WAIT_MS);
    expect(h.events.at(-1)).toEqual({ type: 'failed', kind: 'timeout', rest: ['Two.'] });
  });

  it('a ready sentence cancels its wait', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    h.fire(SERVER_VOICE_WAIT_MS);
    expect(h.types()).toEqual([]);
    expect(h.players).toHaveLength(1);
  });

  it('a file that cannot be written fails as file', async () => {
    const h = speakerOver();
    h.writeFails.next = true;
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    expect(h.events).toEqual([{ type: 'failed', kind: 'file', rest: ['One.'] }]);
  });

  it('a player that never starts is a play error; the sentence is handed over again', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    await answer(h, 0);
    h.fire(SERVER_PLAY_START_MS);
    expect(h.events).toEqual([{ type: 'failed', kind: 'play_error', rest: ['One.', 'Two.'] }]);
    expect(h.playerOf(0).stopped).toBe(true);
    expect(h.requests[1]?.signal.aborted).toBe(true);
  });

  it("the player's own error is a play error", async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    h.playerOf(0).handlers.onError();
    expect(h.events).toEqual([{ type: 'failed', kind: 'play_error', rest: ['One.'] }]);
  });

  it('a file that plays past its length and the slack has stalled', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    h.playerOf(0).handlers.onPlaying(2);
    h.fire(2000 + SERVER_PLAY_END_SLACK_MS);
    expect(h.events.at(-1)).toEqual({ type: 'failed', kind: 'play_stalled', rest: ['One.'] });
  });

  it('with no length known, the most a file may play', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    h.playerOf(0).handlers.onPlaying(0);
    h.fire(SERVER_PLAY_MAX_MS);
    expect(h.events.at(-1)).toMatchObject({ type: 'failed', kind: 'play_stalled' });
  });

  it('a player that throws is a play error', async () => {
    const h = speakerOver({
      play: () => {
        throw new Error('no player');
      },
    });
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    expect(h.events).toEqual([{ type: 'failed', kind: 'play_error', rest: ['One.'] }]);
  });

  it('after a failure the speaker starts afresh', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.requests[0]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    h.speaker.speak('Again.', SERVER_SPEECH);
    await answer(h, 1);
    h.playerOf(0).handlers.onPlaying(1);
    h.playerOf(0).handlers.onEnded();
    await settle();
    expect(h.types()).toEqual(['failed', 'speak_start', 'speak_done']);
  });
});
