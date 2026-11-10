// The server speaker's marks (voice latency A-5) over the fake ports: a sentence whose speech
// carries a turn marks its request, its MP3, the player's call and its first sound, in order, by
// the turn's reference; a failure marks the turn that fell back; a sentence with no turn (the AI
// notice, a brief, a sample) marks nothing; and with no mark port the speaker is as it was.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { SERVER_VOICE_WAIT_MS } from '../config';
import { createServerSpeaker } from '../server/server-speaker';
import type { ServerSpeakerEvent, ServerSpeakerPorts } from '../server/server-speaker-ports';
import { SpeechFailure } from '../server/voice-api';
import { SERVER_SPEECH, SERVER_SPEECH_TURN, fakeServerPorts, settle } from './server-ports';

const REF = SERVER_SPEECH_TURN.turn?.ref ?? '';

function speakerOver(change: (ports: ServerSpeakerPorts) => ServerSpeakerPorts = (ports) => ports) {
  const fake = fakeServerPorts();
  const events: ServerSpeakerEvent[] = [];
  const speaker = createServerSpeaker(change(fake.ports), (event) => events.push(event));
  return { ...fake, speaker, events };
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a sentence that carries a turn', () => {
  it('marks tts_sent, tts_received, play_called and reply_audio in order, with its ref', async () => {
    const h = speakerOver();
    h.speaker.speak('Two meetings.', SERVER_SPEECH_TURN);
    expect(h.marks).toEqual([`${REF} tts_sent`]);
    h.requests[0]?.answer();
    await settle();
    expect(h.marks).toEqual([`${REF} tts_sent`, `${REF} tts_received`, `${REF} play_called`]);
    h.playerOf(0).handlers.onPlaying(1);
    expect(h.marks.at(-1)).toBe(`${REF} reply_audio`);
    expect(h.marks).toHaveLength(4);
  });

  it('a clip that ends before its player said it was playing still marks reply_audio', async () => {
    const h = speakerOver();
    h.speaker.speak('Hi.', SERVER_SPEECH_TURN);
    h.requests[0]?.answer();
    await settle();
    h.playerOf(0).handlers.onEnded();
    expect(h.marks.at(-1)).toBe(`${REF} reply_audio`);
  });

  it('a failed fetch marks tts_failed', async () => {
    const h = speakerOver();
    h.speaker.speak('Two meetings.', SERVER_SPEECH_TURN);
    h.requests[0]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    expect(h.marks).toEqual([`${REF} tts_sent`, `${REF} tts_failed`]);
    expect(h.events.at(-1)).toMatchObject({ type: 'failed', kind: 'tts_busy' });
  });

  it('a wait that runs out marks tts_failed', () => {
    const h = speakerOver();
    h.speaker.speak('Two meetings.', SERVER_SPEECH_TURN);
    h.fire(SERVER_VOICE_WAIT_MS);
    expect(h.marks.at(-1)).toBe(`${REF} tts_failed`);
  });

  it('a failed notice ahead of it marks the turn that falls back with it', async () => {
    const h = speakerOver();
    h.speaker.speak('Auto is an AI.', SERVER_SPEECH);
    h.speaker.speak('Two meetings.', SERVER_SPEECH_TURN);
    h.requests[0]?.refuse(new SpeechFailure('tts_unavailable'));
    await settle();
    expect(h.marks).toEqual([`${REF} tts_failed`]);
    expect(h.events.at(-1)).toMatchObject({ rest: ['Auto is an AI.', 'Two meetings.'] });
  });
});

describe('a sentence without a turn (the AI notice, a brief, a sample)', () => {
  it('marks nothing, played or failed', async () => {
    const h = speakerOver();
    h.speaker.speak('Hello.', SERVER_SPEECH);
    h.requests[0]?.answer();
    await settle();
    h.playerOf(0).handlers.onPlaying(1);
    h.playerOf(0).handlers.onEnded();
    await settle();
    h.speaker.speak('Again.', SERVER_SPEECH);
    h.requests[1]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    expect(h.marks).toEqual([]);
  });

  it('the notice ahead of a reply marks nothing; the reply marks its own', async () => {
    const h = speakerOver();
    h.speaker.speak('Auto is an AI.', SERVER_SPEECH);
    h.speaker.speak('Two meetings.', SERVER_SPEECH_TURN);
    h.requests[0]?.answer();
    await settle();
    h.playerOf(0).handlers.onPlaying(1);
    expect(h.marks).toEqual([`${REF} tts_sent`]);
    h.requests[1]?.answer();
    await settle();
    h.playerOf(0).handlers.onEnded();
    await settle();
    h.playerOf(1).handlers.onPlaying(1);
    expect(h.marks).toEqual([
      `${REF} tts_sent`,
      `${REF} tts_received`,
      `${REF} play_called`,
      `${REF} reply_audio`,
    ]);
  });
});

describe('with no mark port', () => {
  it('speaks, plays and fails as before', async () => {
    const h = speakerOver(({ mark: _mark, ...rest }) => rest);
    h.speaker.speak('Two meetings.', SERVER_SPEECH_TURN);
    h.speaker.speak('One at ten.', SERVER_SPEECH_TURN);
    h.requests[0]?.answer();
    await settle();
    h.playerOf(0).handlers.onPlaying(1);
    h.requests[1]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    h.playerOf(0).handlers.onEnded();
    await settle();
    expect(h.events.map((event) => event.type)).toEqual(['speak_start', 'failed']);
    expect(h.events.at(-1)).toMatchObject({ rest: ['One at ten.'] });
    expect(h.marks).toEqual([]);
  });
});
