// The reply voice: the phone's speaker exactly as before when the speech asks for no server voice;
// the server voice when it does; on a failure the failed sentence, the rest and every later
// sentence of the turn in the phone's voice; the next turn (newTurn, stop) tries the server again;
// one speak_start, one speak_done and one stopped per run whichever voice speaks; one listener
// stack over both.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { createServerSpeaker } from '../server/server-speaker';
import type { ServerSpeakerEvent, ServerSpeech } from '../server/server-speaker-ports';
import { SpeechFailure } from '../server/voice-api';
import { createReplyVoice } from '../speech/reply-voice';
import { createSpeaker, type SpeakOptions, type SpeakerEvent } from '../speech/speaker-core';
import { SERVER_SPEECH, fakeServerPorts, settle } from './server-ports';
import { spySpeechPort } from './speech-port';

const PHONE: SpeakOptions = Object.freeze({
  language: 'en-GB',
  voice: 'Daniel',
  rate: 1.1,
  pitch: 0.9,
});
const SERVER: SpeakOptions = Object.freeze({ ...PHONE, server: SERVER_SPEECH });

/** A stand-in server voice: what it was asked, and its handler to play events on. */
function stubServer() {
  const spoken: { text: string; server: ServerSpeech }[] = [];
  const stop = vi.fn();
  const handOver = vi.fn();
  let emit: (event: ServerSpeakerEvent) => void = () => undefined;
  const make = (handler: (event: ServerSpeakerEvent) => void) => {
    emit = handler;
    return {
      speak: (text: string, server: ServerSpeech) => {
        spoken.push({ text, server });
      },
      stop,
      handOver,
      busy: () => spoken.length > 0,
    };
  };
  return { make, spoken, stop, handOver, emit: (event: ServerSpeakerEvent) => emit(event) };
}

function voiceOver() {
  const speech = spySpeechPort();
  const phone = createSpeaker(speech.port, 'ios');
  const server = stubServer();
  const voice = createReplyVoice({ phone, server: server.make });
  const events: SpeakerEvent[] = [];
  voice.listen((event) => events.push(event));
  const said = () => speech.utterances.map(({ text }) => text);
  return { speech, server, voice, events, said };
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('without a server voice', () => {
  it("speaks through the phone's speaker exactly as before, with its own events", () => {
    const h = voiceOver();
    h.voice.speak('Hello.', PHONE);
    h.voice.speak('Two.', PHONE);
    expect(h.said()).toEqual(['Hello.', 'Two.']);
    expect(h.speech.at(0)).toMatchObject({
      language: 'en-GB',
      voice: 'Daniel',
      rate: 1.1,
      pitch: 0.9,
    });
    expect(h.server.spoken).toEqual([]);
    h.speech.at(0).onStart();
    h.speech.at(0).onDone();
    h.speech.at(1).onStart();
    h.speech.at(1).onDone();
    expect(h.events.map((event) => event.type)).toEqual(['speak_start', 'speak_done']);
  });

  it('passes the voices, the pick and the list through to the phone', async () => {
    const h = voiceOver();
    expect(await h.voice.voices()).toEqual([]);
    expect(await h.voice.voiceFor('en-GB', null)).toBeUndefined();
    expect(await h.voice.choicesFor('en-GB')).toEqual([{ kind: 'automatic' }]);
  });
});

describe('with the server voice', () => {
  it('speaks every sentence through it and folds its events', () => {
    const h = voiceOver();
    h.voice.speak('Hello.', SERVER);
    h.voice.speak('Two.', SERVER);
    expect(h.server.spoken.map(({ text }) => text)).toEqual(['Hello.', 'Two.']);
    expect(h.server.spoken[0]?.server).toBe(SERVER_SPEECH);
    expect(h.said()).toEqual([]);
    h.server.emit({ type: 'speak_start' });
    h.server.emit({ type: 'speak_done' });
    expect(h.events.map((event) => event.type)).toEqual(['speak_start', 'speak_done']);
  });

  it('on a failure: the failed sentence, the rest and the turn after it in the phone voice', () => {
    const h = voiceOver();
    h.voice.speak('Hello.', SERVER);
    h.voice.speak('Two.', SERVER);
    h.server.emit({ type: 'failed', kind: 'tts_busy', rest: ['Hello.', 'Two.'] });
    expect(h.said()).toEqual(['Hello.', 'Two.']);
    expect(h.speech.at(0)).toMatchObject({ voice: 'Daniel', rate: 1.1, pitch: 0.9 });
    h.voice.speak('Three.', SERVER);
    expect(h.said()).toEqual(['Hello.', 'Two.', 'Three.']);
    expect(h.server.spoken.map(({ text }) => text)).toEqual(['Hello.', 'Two.']);
    h.speech.at(0).onStart();
    [0, 1, 2].forEach((index) => h.speech.at(index).onDone());
    expect(h.events.map((event) => event.type)).toEqual(['speak_start', 'speak_done']);
  });

  it('a later sentence of the same turn stays on the phone even after a pause', () => {
    const h = voiceOver();
    h.voice.speak('Hello.', SERVER);
    h.server.emit({ type: 'failed', kind: 'timeout', rest: ['Hello.'] });
    h.speech.at(0).onStart();
    h.speech.at(0).onDone();
    h.voice.speak('Later.', SERVER);
    expect(h.said()).toEqual(['Hello.', 'Later.']);
  });

  it('says speak_start once when the server spoke before it failed', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.voice.speak('Two.', SERVER);
    h.server.emit({ type: 'speak_start' });
    h.server.emit({ type: 'failed', kind: 'play_stalled', rest: ['Two.'] });
    h.speech.at(0).onStart();
    h.speech.at(0).onDone();
    expect(h.events.map((event) => event.type)).toEqual(['speak_start', 'speak_done']);
  });

  it('the next turn tries the server again (newTurn)', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.server.emit({ type: 'failed', kind: 'tts_off', rest: ['One.'] });
    h.speech.at(0).onDone();
    h.voice.newTurn();
    h.voice.speak('Next turn.', SERVER);
    expect(h.server.spoken.map(({ text }) => text)).toEqual(['One.', 'Next turn.']);
  });

  it('a newTurn mid-run waits for the run to end', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.server.emit({ type: 'failed', kind: 'tts_off', rest: ['One.'] });
    h.voice.newTurn();
    h.voice.speak('Same run.', SERVER);
    expect(h.said()).toEqual(['One.', 'Same run.']);
    h.speech.at(0).onDone();
    h.speech.at(1).onDone();
    h.voice.speak('After.', SERVER);
    expect(h.server.spoken.map(({ text }) => text)).toEqual(['One.', 'After.']);
  });

  it('stop lets the next turn try the server again', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.server.emit({ type: 'failed', kind: 'network', rest: ['One.'] });
    h.voice.stop();
    h.voice.speak('Again.', SERVER);
    expect(h.server.spoken.map(({ text }) => text)).toEqual(['One.', 'Again.']);
  });

  it('a failure with nothing left ends the run', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.server.emit({ type: 'failed', kind: 'network', rest: [] });
    expect(h.events.map((event) => event.type)).toEqual(['speak_done']);
  });
});

describe('stop', () => {
  it('stops both voices and says stopped once when a run was under way', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.voice.stop();
    expect(h.server.stop).toHaveBeenCalledTimes(1);
    expect(h.speech.port.stop).toHaveBeenCalledTimes(1);
    expect(h.events.map((event) => event.type)).toEqual(['stopped']);
  });

  it('handOver (a barge-in) hands the server voice over instead of stopping it, and says stopped', () => {
    const h = voiceOver();
    h.voice.speak('One.', SERVER);
    h.server.emit({ type: 'failed', kind: 'tts_busy', rest: ['One.'] });
    h.voice.handOver();
    expect(h.server.handOver).toHaveBeenCalledTimes(1);
    expect(h.server.stop).not.toHaveBeenCalled();
    expect(h.speech.port.stop).toHaveBeenCalledTimes(1);
    expect(h.events.map((event) => event.type)).toEqual(['stopped']);
    h.voice.speak('Next.', SERVER);
    expect(h.server.spoken.map(({ text }) => text)).toEqual(['One.', 'Next.']);
  });

  it('says nothing when idle, and a stopped phone run says stopped once', () => {
    const h = voiceOver();
    h.voice.stop();
    expect(h.events).toEqual([]);
    h.voice.speak('Phone.', PHONE);
    h.voice.stop();
    expect(h.events.map((event) => event.type)).toEqual(['stopped']);
  });

  it('ignores a blank sentence', () => {
    const h = voiceOver();
    h.voice.speak('  ', SERVER);
    h.voice.stop();
    expect(h.events).toEqual([]);
  });
});

describe('one listener stack over both voices', () => {
  it('a newer listener covers the older and hears the events until removed', () => {
    const h = voiceOver();
    const covered = vi.fn();
    const older: SpeakerEvent[] = [];
    h.voice.listen((event) => older.push(event), covered);
    const newer: SpeakerEvent[] = [];
    const remove = h.voice.listen((event) => newer.push(event));
    expect(covered).toHaveBeenCalledTimes(1);
    h.voice.speak('One.', SERVER);
    h.server.emit({ type: 'speak_start' });
    expect(newer).toHaveLength(1);
    expect(older).toHaveLength(0);
    remove();
    h.server.emit({ type: 'speak_done' });
    expect(older.map((event) => event.type)).toEqual(['speak_done']);
  });
});

describe('over the real server speaker', () => {
  it('a refusal speaks the rest of the turn on the phone, and the next turn tries again', async () => {
    const fake = fakeServerPorts();
    const speech = spySpeechPort();
    const voice = createReplyVoice({
      phone: createSpeaker(speech.port, 'ios'),
      server: (emit) => createServerSpeaker(fake.ports, emit),
    });
    voice.speak('Hi, this is Auto.', SERVER);
    voice.speak('Two meetings.', SERVER);
    fake.requests[0]?.refuse(new SpeechFailure('tts_unavailable'));
    await settle();
    expect(speech.utterances.map(({ text }) => text)).toEqual([
      'Hi, this is Auto.',
      'Two meetings.',
    ]);
    speech.at(0).onDone();
    speech.at(1).onDone();
    voice.newTurn();
    voice.speak('Next.', SERVER);
    expect(fake.requests.map((request) => request.text)).toEqual(['Hi, this is Auto.', 'Next.']);
  });
});
