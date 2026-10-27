// The server speaker's audio session over fake ports: set once per run before its first file and
// never touched between sentences; released (other audio back to full volume) when the run ends by
// its last sentence, stop() or a failure handed to the phone; left alone at a barge-in (handOver),
// where the recognizer takes it; every change in order, a failed release logged.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { createServerSpeaker } from '../server/server-speaker';
import type { ServerSpeakerEvent } from '../server/server-speaker-ports';
import { SpeechFailure } from '../server/voice-api';
import { SERVER_SPEECH, fakeServerPorts, settle } from './server-ports';

function speakerOver() {
  const fake = fakeServerPorts();
  const events: ServerSpeakerEvent[] = [];
  const speaker = createServerSpeaker(fake.ports, (event) => events.push(event));
  const types = () => events.map((event) => event.type);
  return { ...fake, speaker, events, types };
}

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

describe('the audio session', () => {
  async function playOut(h: ReturnType<typeof speakerOver>, index: number): Promise<void> {
    await answer(h, index);
    h.playerOf(index).handlers.onPlaying(1);
    h.playerOf(index).handlers.onEnded();
    await settle();
  }

  it('is set once and never touched between sentences, then released after the last', async () => {
    const h = speakerOver();
    ['One.', 'Two.', 'Three.'].forEach((text) => h.speaker.speak(text, SERVER_SPEECH));
    await playOut(h, 0);
    await playOut(h, 1);
    expect(h.session).toEqual(['prepare']);
    await playOut(h, 2);
    expect(h.types()).toEqual(['speak_start', 'speak_done']);
    expect(h.session).toEqual(['prepare', 'release']);
  });

  it('is released when stop() ends the run', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    await answer(h, 0);
    h.speaker.stop();
    await settle();
    expect(h.session).toEqual(['prepare', 'release']);
  });

  it('is released when a failure hands the turn to the phone', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.requests[0]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    expect(h.types()).toEqual(['failed']);
    expect(h.session).toEqual(['prepare', 'release']);
  });

  it('is left to the recognizer at a barge-in (handOver): the run ends, nothing released', async () => {
    const h = speakerOver();
    h.speaker.speak('One.', SERVER_SPEECH);
    h.speaker.speak('Two.', SERVER_SPEECH);
    await answer(h, 0);
    h.playerOf(0).handlers.onPlaying(2);
    h.speaker.handOver();
    await settle();
    expect(h.session).toEqual(['prepare']);
    expect(h.playerOf(0).stopped).toBe(true);
    expect(h.requests[1]?.signal.aborted).toBe(true);
    expect(h.removed).toEqual(['file:///cache/server-voice/1.mp3']);
    expect(h.speaker.busy()).toBe(false);
    h.speaker.speak('Next run.', SERVER_SPEECH);
    await settle();
    expect(h.session).toEqual(['prepare', 'prepare']);
  });

  it('is not released by a stop or a hand-over with nothing under way', async () => {
    const h = speakerOver();
    h.speaker.stop();
    h.speaker.handOver();
    await settle();
    expect(h.session).toEqual([]);
  });

  it('a release that fails is logged, and the next run still sets the session', async () => {
    const h = speakerOver();
    h.release.mockRejectedValueOnce(new Error('session busy'));
    h.speaker.speak('One.', SERVER_SPEECH);
    await playOut(h, 0);
    expect(logger.warn).toHaveBeenCalledWith(
      '[voice] the audio session was not released',
      expect.any(Error),
    );
    h.speaker.speak('Two.', SERVER_SPEECH);
    await answer(h, 1);
    expect(h.prepare).toHaveBeenCalledTimes(2);
    expect(h.players).toHaveLength(2);
  });
});
